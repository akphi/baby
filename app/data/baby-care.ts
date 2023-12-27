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
import { hasher as initHasher } from "node-object-hash";
import { readFileSync } from "node:fs";
import { returnUndefOnError } from "../shared/CommonUtils";
import { guaranteeNonEmptyString } from "../shared/AssertionUtils";
import { ContentType, HttpHeader, HttpMethod } from "../shared/NetworkUtils";

const HASHER = initHasher({});

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

export const DEFAULT_NURSING_DURATION_FOR_EACH_SIDE = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_PUMPING_DURATION = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_PUMPING_INTERNAL = 3 * 60 * 60 * 1000; // 3 hours
export const DEFAULT_FEEDING_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours
export const DEFAULT_FEEDING_VOLUME = 60; // 60 ml

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
  defaultFeedingInterval?: number | undefined;

  @Property({ type: "number", nullable: true })
  defaultFeedingVolume?: number | undefined;

  @Property({ type: "number", nullable: true })
  defaultPumpingInterval?: number | undefined;

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
  // Keep track of type of event during serialization
  // Shadowed field that should not be persisted to the DB
  // See https://mikro-orm.io/docs/serializing#shadow-properties
  @Property({ type: "string", persist: false })
  type!: string;

  // Keep track of hash of event
  @Property({ type: "string", persist: false })
  hash!: string;

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

  abstract get hashCode(): string;
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

  override get hashCode() {
    return HASHER.hash({
      type: BabyCareEventType.BOTTLE_FEED,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,

      volume: this.volume,
      formulaMilkVolume: this.formulaMilkVolume,
    });
  }
}

@Entity()
export class NursingEvent extends BabyCareEvent {
  @Property({ type: "number" })
  leftDuration = 0;

  @Property({ type: "number" })
  rightDuration = 0;

  override get hashCode() {
    return HASHER.hash({
      type: BabyCareEventType.NURSING,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,

      leftDuration: this.leftDuration,
      rightDuration: this.rightDuration,
    });
  }
}

@Entity()
export class PumpingEvent extends BabyCareEvent {
  @Property({ type: "number" })
  volume = 0;

  override get hashCode() {
    return HASHER.hash({
      type: BabyCareEventType.PUMPING,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,

      volume: this.volume,
    });
  }
}

@Entity()
export class DiaperChangeEvent extends BabyCareEvent {
  // NOTE: this is a fair default, every time we change diaper, it's likely due to poop or pee,
  // but mostly likely poop comes with pee
  @Property({ type: "boolean" })
  pee = true;

  @Property({ type: "boolean" })
  poop = false;

  override get hashCode() {
    return HASHER.hash({
      type: BabyCareEventType.DIAPER_CHANGE,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,

      pee: this.pee,
      poop: this.poop,
    });
  }
}

@Entity()
export class SleepEvent extends BabyCareEvent {
  override get hashCode() {
    return HASHER.hash({
      type: BabyCareEventType.SLEEP,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,
    });
  }
}

@Entity()
export class PlayEvent extends BabyCareEvent {
  override get hashCode() {
    return HASHER.hash({
      type: BabyCareEventType.PLAY,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,
    });
  }
}

@Entity()
export class BathEvent extends BabyCareEvent {
  override get hashCode() {
    return HASHER.hash({
      type: BabyCareEventType.BATH,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,
    });
  }
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
              wrap(event).assign({
                type: BabyCareEventType.BOTTLE_FEED,
                hash: event.hashCode,
              })
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
              wrap(event).assign({
                type: BabyCareEventType.NURSING,
                hash: event.hashCode,
              })
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
              wrap(event).assign({
                type: BabyCareEventType.PUMPING,
                hash: event.hashCode,
              })
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
              wrap(event).assign({
                type: BabyCareEventType.DIAPER_CHANGE,
                hash: event.hashCode,
              })
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
              wrap(event).assign({
                type: BabyCareEventType.SLEEP,
                hash: event.hashCode,
              })
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
              wrap(event).assign({
                type: BabyCareEventType.PLAY,
                hash: event.hashCode,
              })
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
              wrap(event).assign({
                type: BabyCareEventType.BATH,
                hash: event.hashCode,
              })
            )
          ),
      ])
    )
      .flat()
      // sort latest events first
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    return events;
  }

  public static async remind(message: string) {
    const config = JSON.parse(
      readFileSync("../home-storage/home.config.json", { encoding: "utf-8" })
    );
    const url = returnUndefOnError(() =>
      guaranteeNonEmptyString(config.babyCare.reminderWebhookUrl)
    );
    if (!url) {
      return;
    }
    await fetch(url, {
      method: HttpMethod.POST,
      headers: {
        [HttpHeader.CONTENT_TYPE]: ContentType.APPLICATION_JSON,
      },
      body: JSON.stringify({
        content: message,
        username: "Reminder",
      }),
    });
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
