import {
  MikroORM,
  type Options,
  type IDatabaseDriver,
  type Connection,
  Property,
  ManyToOne,
  TableExistsException,
  DateType,
  wrap,
} from "@mikro-orm/core";
import { Entity, PrimaryKey } from "@mikro-orm/core";
import { add, startOfDay } from "date-fns";
import { v4 as uuid } from "uuid";

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

export const DEFAULT_NURSING_DURATION_FOR_EACH_SIDE = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_PUMPING_DURATION = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_FEEDING_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours
export const DEFAULT_FEEDING_VOLUME = 60;

@Entity()
export class BabyCareProfile {
  @PrimaryKey({ type: "string" })
  readonly id = uuid();

  @Property({ type: "string" })
  name: string;

  @Property({ type: () => Gender })
  genderAtBirth: Gender;

  @Property({ type: DateType })
  dob: Date;

  @Property({ type: "string", nullable: true })
  shortId?: string | undefined;

  @Property({ type: "string", nullable: true })
  nickname?: string | undefined;

  @Property({ type: "number", nullable: true })
  feedingInterval?: number | undefined;

  @Property({ type: "number", nullable: true })
  defaultFeedingVolume?: number | undefined;

  @Property({ type: "number", nullable: true })
  defaultPumpingDuration?: number | undefined;

  constructor(name: string, genderAtBirth: Gender, dob: Date) {
    this.name = name;
    this.genderAtBirth = genderAtBirth;
    this.dob = dob;
  }
}

export enum BabyCareEventType {
  BOTTLE_FEED = "Bottle",
  NURSING = "Nursing",
  PUMPING = "Pumping",
  DIAPER_CHANGE = "Diaper Change",
  SLEEP = "Sleep",
  PLAY = "Play",
  BATH = "Bath",

  __POOP = "Poop",
  __PEE = "Pee",
}

export abstract class BabyCareEvent {
  // Shadowed field that should not be persisted to the DB, used to keep track of type of event
  // See https://mikro-orm.io/docs/serializing#shadow-properties
  @Property({ type: "string", persist: false })
  type!: string;

  @PrimaryKey({ type: "string" })
  readonly id = uuid();

  @ManyToOne(() => BabyCareProfile, { onDelete: "cascade" })
  readonly profile: BabyCareProfile;

  // NOTE: This should be 'DateTimeType', but there's a bug in v5 where this gets returned as timestamp for SQLite
  // The workaround is to use `Date` type. This should be fixed in v6
  // See https://github.com/mikro-orm/mikro-orm/issues/4362
  @Property({ type: Date })
  time: Date;

  @Property({ type: "number", nullable: true })
  duration?: number | undefined;

  @Property({ type: "string", nullable: true })
  comment?: string | undefined;

  // TODO: if this is useful, we can have a separate table for tags per event type
  // this would enable a quick way to add extra metadata to events
  // @Property({ type: "string", nullable: true })
  // tags?: string[] | undefined;

  constructor(time: Date, profile: BabyCareProfile) {
    this.time = time;
    this.profile = profile;
  }
}

@Entity()
export class BottleFeedEvent extends BabyCareEvent {
  @Property({ type: "number" })
  volume: number;

  @Property({ type: "number", nullable: true })
  formulaMilkVolume?: number | undefined;

  constructor(time: Date, profile: BabyCareProfile, volume: number) {
    super(time, profile);
    this.volume = volume;
  }
}

@Entity()
export class NursingEvent extends BabyCareEvent {
  @Property({ type: "number" })
  leftDuration = 0;

  @Property({ type: "number" })
  rightDuration = 0;
}

@Entity()
export class PumpingEvent extends BabyCareEvent {
  @Property({ type: "number" })
  volume = 0;
}

@Entity()
export class DiaperChangeEvent extends BabyCareEvent {
  // NOTE: this is a fair default, every time we change diaper, it's likely due to poop or pee,
  // but mostly likely poop comes with pee
  @Property({ type: "boolean" })
  pee = true;

  @Property({ type: "boolean" })
  poop = false;
}

@Entity()
export class SleepEvent extends BabyCareEvent {}

@Entity()
export class PlayEvent extends BabyCareEvent {}

@Entity()
export class BathEvent extends BabyCareEvent {}

const BABY_CARE_DB_CONFIG: Options = {
  dbName: "../home-storage/baby-care.sqlite",
  type: "sqlite",
  entities: [
    BabyCareProfile,
    BottleFeedEvent,
    NursingEvent,
    PumpingEvent,
    DiaperChangeEvent,
    SleepEvent,
    PlayEvent,
    BathEvent,
  ],
  discovery: { disableDynamicFileAccess: true },
};

export class BabyCareDataRegistry {
  private static _instance: BabyCareDataRegistry;
  private static _orm: MikroORM<IDatabaseDriver<Connection>>;

  // eslint-disable-next-line no-useless-constructor
  private constructor() {}

  public static getInstance(): BabyCareDataRegistry {
    if (!BabyCareDataRegistry._instance) {
      BabyCareDataRegistry._instance = new BabyCareDataRegistry();
    }
    return BabyCareDataRegistry._instance;
  }

  public static async getORM() {
    if (!BabyCareDataRegistry._orm) {
      const orm = await MikroORM.init(BABY_CARE_DB_CONFIG);
      // auto-populate the first time
      try {
        await orm.getSchemaGenerator().createSchema();
      } catch (error) {
        // optimistic schema update
        if (error instanceof TableExistsException) {
          try {
            await orm.getSchemaGenerator().updateSchema();
          } catch {
            // do nothing
          }
        }
      }
      BabyCareDataRegistry._orm = orm;
    }
    return BabyCareDataRegistry._orm;
  }

  public static async getEntityManager() {
    return (await BabyCareDataRegistry.getORM()).em.fork();
  }

  public static async fetchEvents(profile: BabyCareProfile, date: Date) {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const events: BabyCareEvent[] = (
      await Promise.all([
        entityManager
          .find(BottleFeedEvent, {
            $and: [
              { profile },
              {
                time: {
                  $gte: startOfDay(date),
                  $lt: startOfDay(add(date, { days: 1 })),
                },
              },
            ],
          })
          .then((events) =>
            events.map((event) =>
              wrap(event).assign({ type: BabyCareEventType.BOTTLE_FEED })
            )
          ),
        entityManager
          .find(NursingEvent, {
            $and: [
              { profile },
              {
                time: {
                  $gte: startOfDay(date),
                  $lt: startOfDay(add(date, { days: 1 })),
                },
              },
            ],
          })
          .then((events) =>
            events.map((event) =>
              wrap(event).assign({ type: BabyCareEventType.NURSING })
            )
          ),
        entityManager
          .find(PumpingEvent, {
            $and: [
              { profile },
              {
                time: {
                  $gte: startOfDay(date),
                  $lt: startOfDay(add(date, { days: 1 })),
                },
              },
            ],
          })
          .then((events) =>
            events.map((event) =>
              wrap(event).assign({ type: BabyCareEventType.PUMPING })
            )
          ),
        entityManager
          .find(DiaperChangeEvent, {
            $and: [
              { profile },
              {
                time: {
                  $gte: startOfDay(date),
                  $lt: startOfDay(add(date, { days: 1 })),
                },
              },
            ],
          })
          .then((events) =>
            events.map((event) =>
              wrap(event).assign({ type: BabyCareEventType.DIAPER_CHANGE })
            )
          ),
        entityManager
          .find(SleepEvent, {
            $and: [
              { profile },
              {
                time: {
                  $gte: startOfDay(date),
                  $lt: startOfDay(add(date, { days: 1 })),
                },
              },
            ],
          })
          .then((events) =>
            events.map((event) =>
              wrap(event).assign({ type: BabyCareEventType.SLEEP })
            )
          ),
        entityManager
          .find(PlayEvent, {
            $and: [
              { profile },
              {
                time: {
                  $gte: startOfDay(date),
                  $lt: startOfDay(add(date, { days: 1 })),
                },
              },
            ],
          })
          .then((events) =>
            events.map((event) =>
              wrap(event).assign({ type: BabyCareEventType.PLAY })
            )
          ),
        entityManager
          .find(BathEvent, {
            $and: [
              { profile },
              {
                time: {
                  $gte: startOfDay(date),
                  $lt: startOfDay(add(date, { days: 1 })),
                },
              },
            ],
          })
          .then((events) =>
            events.map((event) =>
              wrap(event).assign({ type: BabyCareEventType.BATH })
            )
          ),
      ])
    )
      .flat()
      // sort latest events first
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    return events;
  }
}

export enum BabyCareAction {
  CREATE_PROFILE = "baby-care.profile.create",
  UPDATE_PROFILE = "baby-care.profile.update",
  REMOVE_PROFILE = "baby-care.profile.remove",

  CREATE_BOTTLE_FEED_EVENT = "baby-care.bottle-feed-event.create",
  UPDATE_BOTTLE_FEED_EVENT = "baby-care.bottle-feed-event.update",
  REMOVE_BOTTLE_FEED_EVENT = "baby-care.bottle-feed-event.remove",

  CREATE_PUMPING_EVENT = "baby-care.pumping-event.create",
  UPDATE_PUMPING_EVENT = "baby-care.pumping-event.update",
  REMOVE_PUMPING_EVENT = "baby-care.pumping-event.remove",

  CREATE_NURSING_EVENT = "baby-care.nursing-event.create",
  UPDATE_NURSING_EVENT = "baby-care.nursing-event.update",
  REMOVE_NURSING_EVENT = "baby-care.nursing-event.remove",

  CREATE_DIAPER_CHANGE_POOP_EVENT = "baby-care.diaper-change-event.poop.create",
  CREATE_DIAPER_CHANGE_PEE_EVENT = "baby-care.diaper-change-event.pee.create",
  UPDATE_DIAPER_CHANGE_EVENT = "baby-care.diaper-change-event.update",
  REMOVE_DIAPER_CHANGE_EVENT = "baby-care.diaper-change-event.remove",

  CREATE_SLEEP_EVENT = "baby-care.sleep-event.create",
  UPDATE_SLEEP_EVENT = "baby-care.sleep-event.update",
  REMOVE_SLEEP_EVENT = "baby-care.sleep-event.remove",

  CREATE_BATH_EVENT = "baby-care.bath-event.create",
  UPDATE_BATH_EVENT = "baby-care.bath-event.update",
  REMOVE_BATH_EVENT = "baby-care.bath-event.remove",

  CREATE_PLAY_EVENT = "baby-care.play-event.create",
  UPDATE_PLAY_EVENT = "baby-care.play-event.update",
  REMOVE_PLAY_EVENT = "baby-care.play-event.remove",
}
