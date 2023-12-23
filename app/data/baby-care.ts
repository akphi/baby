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
}

export abstract class BabyCareEvent {
  // Shadowed field that should not be persisted to the DB, used to keep track of type of event
  // See https://mikro-orm.io/docs/serializing#shadow-properties
  @Property({ type: "string", persist: false })
  type!: string;

  @PrimaryKey({ type: "string" })
  readonly id = uuid();

  // NOTE: This should be 'DateTimeType', but there's a bug in v5 where this gets returned as timestamp for SQLite
  // The workaround is to use `Date` type. This should be fixed in v6
  // See https://github.com/mikro-orm/mikro-orm/issues/4362
  @Property({ type: Date })
  time: Date;

  @Property({ type: "number", nullable: true })
  duration?: number | undefined;

  @ManyToOne(() => BabyCareProfile, { onDelete: "cascade" })
  profile: BabyCareProfile;

  @Property({ type: "string", nullable: true })
  comment?: string | undefined;

  @Property({ type: "string", nullable: true })
  tags?: string[] | undefined;

  constructor(time: Date, profile: BabyCareProfile) {
    this.time = time;
    this.profile = profile;
  }
}

@Entity()
export class BottleFeedEvent extends BabyCareEvent {
  @Property({ type: "number" })
  volume: number;

  // by default, assume undefined breast milk volume means it's 100% breast pumped milk, 0% formula
  @Property({ type: "number", nullable: true })
  breastMilkVolume?: number | undefined;

  constructor(time: Date, profile: BabyCareProfile, volume: number) {
    super(time, profile);
    this.volume = volume;
  }
}

@Entity()
export class NursingEvent extends BabyCareEvent {
  @Property({ type: "number", nullable: true })
  leftDuration?: number | undefined;

  @Property({ type: "number", nullable: true })
  rightDuration?: number | undefined;
}

@Entity()
export class DiaperChangeEvent extends BabyCareEvent {
  @Property({ type: "boolean", nullable: true })
  pee?: boolean | undefined;

  @Property({ type: "boolean", nullable: true })
  poop?: boolean | undefined;
}

@Entity()
export class SleepEvent extends BabyCareEvent {}

@Entity()
export class PlayEvent extends BabyCareEvent {}

@Entity()
export class BathEvent extends BabyCareEvent {}

@Entity()
export class PumpingEvent extends BabyCareEvent {
  @Property({ type: "number", nullable: true })
  volume?: number | undefined;
}

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
