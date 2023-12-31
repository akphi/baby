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
import {
  assertTrue,
  guaranteeNonEmptyString,
  guaranteeNonNullable,
} from "../shared/AssertionUtils";
import { ContentType, HttpHeader, HttpMethod } from "../shared/NetworkUtils";
import {
  DEFAULT_FEEDING_VOLUME,
  DEFAULT_FEEDING_INTERVAL,
  DEFAULT_NIGHT_FEEDING_INTERVAL,
  DEFAULT_PUMPING_DURATION,
  DEFAULT_PUMPING_INTERNAL,
  DEFAULT_NIGHT_PUMPING_INTERNAL,
  DEFAULT_BABY_DAYTIME_START_HOUR,
  DEFAULT_BABY_DAYTIME_END_HOUR,
  DEFAULT_PARENT_DAYTIME_START_HOUR,
  DEFAULT_PARENT_DAYTIME_END_HOUR,
  DEFAULT_NURSING_DURATION_FOR_EACH_SIDE,
} from "./constants";
import EventEmitter from "node:events";
import {
  extractOptionalNumber,
  extractOptionalString,
  extractRequiredBoolean,
  extractRequiredNumber,
  extractRequiredString,
} from "../shared/FormDataUtils";

const HASHER = initHasher({});

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

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
  handle?: string | undefined;

  @Property({ type: "string", nullable: true })
  nickname?: string | undefined;

  // feeding
  @Property({ type: "number" })
  defaultFeedingVolume = DEFAULT_FEEDING_VOLUME;

  @Property({ type: "number" })
  defaultFeedingInterval = DEFAULT_FEEDING_INTERVAL;

  @Property({ type: "number" })
  defaultNightFeedingInterval = DEFAULT_NIGHT_FEEDING_INTERVAL;

  // pumping
  @Property({ type: "number" })
  defaultPumpingDuration = DEFAULT_PUMPING_DURATION;

  @Property({ type: "number" })
  defaultPumpingInterval = DEFAULT_PUMPING_INTERNAL;

  @Property({ type: "number" })
  defaultNightPumpingInterval = DEFAULT_NIGHT_PUMPING_INTERNAL;

  // timing
  @Property({ type: "number" })
  babyDaytimeStart = DEFAULT_BABY_DAYTIME_START_HOUR;

  @Property({ type: "number" })
  babyDaytimeEnd = DEFAULT_BABY_DAYTIME_END_HOUR;

  @Property({ type: "number" })
  parentDaytimeStart = DEFAULT_PARENT_DAYTIME_START_HOUR;

  @Property({ type: "number" })
  parentDaytimeEnd = DEFAULT_PARENT_DAYTIME_END_HOUR;

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
  //
  // Shadowed field that should not be persisted to the DB
  // See https://mikro-orm.io/docs/serializing#shadow-properties
  @Property({ type: "string", persist: false })
  TYPE!: string;

  // Keep track of hash of event for change detection
  @Property({ type: "string", persist: false })
  HASH!: string;

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

  abstract get eventType(): string;

  get hashContent() {
    return {
      type: this.eventType,
      id: this.id,
      profile: this.profile.id,
      time: this.time,
      duration: this.duration,
      comment: this.comment,
    };
  }

  get hashCode() {
    return HASHER.hash(this.hashContent);
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

  override get eventType() {
    return BabyCareEventType.BOTTLE_FEED;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
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

  override get eventType() {
    return BabyCareEventType.NURSING;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      leftDuration: this.leftDuration,
      rightDuration: this.rightDuration,
    });
  }
}

@Entity()
export class PumpingEvent extends BabyCareEvent {
  @Property({ type: "number" })
  volume = 0;

  override get eventType() {
    return BabyCareEventType.PUMPING;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
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

  override get eventType() {
    return BabyCareEventType.DIAPER_CHANGE;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      pee: this.pee,
      poop: this.poop,
    });
  }
}

@Entity()
export class SleepEvent extends BabyCareEvent {
  override get eventType() {
    return BabyCareEventType.SLEEP;
  }
}

@Entity()
export class PlayEvent extends BabyCareEvent {
  override get eventType() {
    return BabyCareEventType.PLAY;
  }
}

@Entity()
export class BathEvent extends BabyCareEvent {
  override get eventType() {
    return BabyCareEventType.BATH;
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

export enum BabyCareServerEvent {
  PROFILE_DATA_CHANGE = "baby-care.profile-data-change",
}

export class BabyCareDataRegistry {
  private static _instance: BabyCareDataRegistry;
  private static _orm: MikroORM<IDatabaseDriver<Connection>>;
  private static _eventEmitter = new EventEmitter();

  // eslint-disable-next-line no-useless-constructor
  private constructor() {}

  static getInstance(): BabyCareDataRegistry {
    if (!BabyCareDataRegistry._instance) {
      BabyCareDataRegistry._instance = new BabyCareDataRegistry();
    }
    return BabyCareDataRegistry._instance;
  }

  static getEventEmitter() {
    return BabyCareDataRegistry._eventEmitter;
  }

  static async message(sender: string, message: string) {
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
        username: sender,
        content: message,
      }),
    });
  }

  static async getORM() {
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

  static async getEntityManager() {
    return (await BabyCareDataRegistry.getORM()).em.fork();
  }

  static async fetchProfiles(): Promise<BabyCareProfile[]> {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const profiles = await entityManager
      .getRepository(BabyCareProfile)
      .findAll();
    return profiles;
  }

  static async fetchProfile(
    profileIdOrHandle: string
  ): Promise<BabyCareProfile> {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const profile = await entityManager.findOneOrFail(BabyCareProfile, {
      $or: [{ id: profileIdOrHandle }, { handle: profileIdOrHandle }],
    });
    return profile;
  }

  static async fetchEvents(profile: BabyCareProfile, date: Date) {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const events: BabyCareEvent[] = (
      await Promise.all([
        entityManager.find(BottleFeedEvent, {
          $and: [
            { profile },
            {
              time: {
                $gte: startOfDay(date),
                $lt: startOfDay(add(date, { days: 1 })),
              },
            },
          ],
        }),
        entityManager.find(NursingEvent, {
          $and: [
            { profile },
            {
              time: {
                $gte: startOfDay(date),
                $lt: startOfDay(add(date, { days: 1 })),
              },
            },
          ],
        }),
        entityManager.find(PumpingEvent, {
          $and: [
            { profile },
            {
              time: {
                $gte: startOfDay(date),
                $lt: startOfDay(add(date, { days: 1 })),
              },
            },
          ],
        }),
        entityManager.find(DiaperChangeEvent, {
          $and: [
            { profile },
            {
              time: {
                $gte: startOfDay(date),
                $lt: startOfDay(add(date, { days: 1 })),
              },
            },
          ],
        }),
        entityManager.find(SleepEvent, {
          $and: [
            { profile },
            {
              time: {
                $gte: startOfDay(date),
                $lt: startOfDay(add(date, { days: 1 })),
              },
            },
          ],
        }),
        entityManager.find(PlayEvent, {
          $and: [
            { profile },
            {
              time: {
                $gte: startOfDay(date),
                $lt: startOfDay(add(date, { days: 1 })),
              },
            },
          ],
        }),
        entityManager.find(BathEvent, {
          $and: [
            { profile },
            {
              time: {
                $gte: startOfDay(date),
                $lt: startOfDay(add(date, { days: 1 })),
              },
            },
          ],
        }),
      ])
    )
      .flat()
      .map((event) =>
        wrap(event).assign({
          TYPE: event.eventType,
          HASH: event.hashCode,
        })
      )
      // sort latest events first
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    return events;
  }

  static async fetchProfileByIdOrHandle(idOrHandle: string) {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const profile = await entityManager.findOneOrFail(BabyCareProfile, {
      $or: [{ id: idOrHandle }, { handle: idOrHandle }],
    });
    return profile;
  }

  private static enforceFormSubmitAction(
    formData: FormData,
    allowedActions: string[]
  ): string {
    const action = extractRequiredString(formData, "__action");
    assertTrue(
      allowedActions.includes(action),
      `Non-matching form submit action '${action}'`
    );
    return action;
  }

  static async createOrUpdateProfile(
    formData: FormData
  ): Promise<{ profile: BabyCareProfile; created: boolean }> {
    BabyCareDataRegistry.enforceFormSubmitAction(formData, [
      BabyCareAction.CREATE_PROFILE,
      BabyCareAction.UPDATE_PROFILE,
    ]);

    const entityManager = await BabyCareDataRegistry.getEntityManager();

    let profile: BabyCareProfile;

    const id = formData.get("id");
    const name = extractRequiredString(formData, "name");
    const dob = new Date(extractRequiredString(formData, "dob"));
    const gender = Gender[extractRequiredString(formData, "gender") as Gender];

    if (id) {
      profile = await entityManager.findOneOrFail(BabyCareProfile, {
        id: id as string,
      });
      profile.name = name;
      profile.dob = dob;
      profile.genderAtBirth = gender;
    } else {
      profile = new BabyCareProfile(name, gender, dob);
    }

    profile.nickname = extractOptionalString(formData, "nickname")?.trim();
    profile.handle = extractOptionalString(formData, "handle")?.trim();

    profile.defaultFeedingVolume = extractRequiredNumber(
      formData,
      "defaultFeedingVolume"
    );
    profile.defaultFeedingInterval = extractRequiredNumber(
      formData,
      "defaultFeedingInterval"
    );
    profile.defaultNightFeedingInterval = extractRequiredNumber(
      formData,
      "defaultNightFeedingInterval"
    );

    profile.defaultPumpingDuration = extractRequiredNumber(
      formData,
      "defaultPumpingDuration"
    );
    profile.defaultPumpingInterval = extractRequiredNumber(
      formData,
      "defaultPumpingInterval"
    );
    profile.defaultNightPumpingInterval = extractRequiredNumber(
      formData,
      "defaultNightPumpingInterval"
    );

    profile.babyDaytimeStart = extractRequiredNumber(
      formData,
      "babyDaytimeStart"
    );
    profile.babyDaytimeEnd = extractRequiredNumber(formData, "babyDaytimeEnd");
    profile.parentDaytimeStart = extractRequiredNumber(
      formData,
      "parentDaytimeStart"
    );
    profile.parentDaytimeEnd = extractRequiredNumber(
      formData,
      "parentDaytimeEnd"
    );

    await entityManager.persistAndFlush(profile);
    BabyCareDataRegistry.getEventEmitter().emit(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      profile.id
    );

    return { profile, created: !id };
  }

  static async removeProfile(formData: FormData) {
    BabyCareDataRegistry.enforceFormSubmitAction(formData, [
      BabyCareAction.REMOVE_PROFILE,
    ]);

    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const profile = await entityManager.findOneOrFail(BabyCareProfile, {
      id: guaranteeNonEmptyString(formData.get("id")),
    });
    await entityManager.removeAndFlush(profile);
    BabyCareDataRegistry.getEventEmitter().emit(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      profile.id
    );
    return profile;
  }

  static async quickCreateEvent(action: string, profileIdOrHandle: string) {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
      profileIdOrHandle
    );
    let event: BabyCareEvent;

    switch (action) {
      case BabyCareAction.CREATE_BOTTLE_FEED_EVENT: {
        event = new BottleFeedEvent(
          new Date(),
          profile,
          profile.defaultFeedingVolume
        );
        break;
      }
      case BabyCareAction.CREATE_NURSING_EVENT: {
        const quickEvent = new NursingEvent(new Date(), profile);
        quickEvent.rightDuration = quickEvent.leftDuration =
          DEFAULT_NURSING_DURATION_FOR_EACH_SIDE;
        event = quickEvent;
        break;
      }
      case BabyCareAction.CREATE_PUMPING_EVENT: {
        const quickEvent = new PumpingEvent(new Date(), profile);
        quickEvent.duration = profile.defaultPumpingDuration;
        quickEvent.volume = profile.defaultFeedingVolume;
        event = quickEvent;
        break;
      }
      case BabyCareAction.CREATE_DIAPER_CHANGE_POOP_EVENT: {
        const quickEvent = new DiaperChangeEvent(new Date(), profile);
        quickEvent.poop = true;
        quickEvent.pee = true;
        event = quickEvent;
        break;
      }
      case BabyCareAction.CREATE_DIAPER_CHANGE_PEE_EVENT: {
        const quickEvent = new DiaperChangeEvent(new Date(), profile);
        quickEvent.pee = true;
        event = quickEvent;
        break;
      }
      case BabyCareAction.CREATE_SLEEP_EVENT: {
        event = new SleepEvent(new Date(), profile);
        break;
      }
      case BabyCareAction.CREATE_PLAY_EVENT: {
        event = new PlayEvent(new Date(), profile);
        break;
      }
      case BabyCareAction.CREATE_BATH_EVENT: {
        event = new BathEvent(new Date(), profile);
        break;
      }
      default:
        throw new Error(`Unsupported quick event creation action '${action}'`);
    }

    entityManager.persistAndFlush(event);
    BabyCareDataRegistry.getEventEmitter().emit(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      profile.id
    );

    event.TYPE = event.eventType;
    event.HASH = event.hashCode;

    return event;
  }

  static async updateEvent(formData: FormData, eventId: string) {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const action = formData.get("__action");

    switch (action) {
      case BabyCareAction.UPDATE_BOTTLE_FEED_EVENT: {
        const event = await entityManager.findOneOrFail(BottleFeedEvent, {
          id: eventId,
        });

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.volume = extractRequiredNumber(formData, "volume");
        event.formulaMilkVolume = extractOptionalNumber(
          formData,
          "formulaMilkVolume"
        );

        entityManager.persistAndFlush(event);
        BabyCareDataRegistry.getEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );

        return event;
      }
      case BabyCareAction.UPDATE_PUMPING_EVENT: {
        const event = await entityManager.findOneOrFail(PumpingEvent, {
          id: eventId,
        });

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.volume = extractRequiredNumber(formData, "volume");

        entityManager.persistAndFlush(event);
        BabyCareDataRegistry.getEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );

        return event;
      }
      case BabyCareAction.UPDATE_NURSING_EVENT: {
        const event = await entityManager.findOneOrFail(NursingEvent, {
          id: eventId,
        });

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.leftDuration = extractRequiredNumber(formData, "leftDuration");
        event.rightDuration = extractRequiredNumber(formData, "rightDuration");

        entityManager.persistAndFlush(event);
        BabyCareDataRegistry.getEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );

        return event;
      }
      case BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT: {
        const event = await entityManager.findOneOrFail(DiaperChangeEvent, {
          id: eventId,
        });

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.poop = extractRequiredBoolean(formData, "poop");
        event.pee = extractRequiredBoolean(formData, "pee");

        entityManager.persistAndFlush(event);
        BabyCareDataRegistry.getEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );

        return event;
      }
      case BabyCareAction.UPDATE_SLEEP_EVENT:
      case BabyCareAction.UPDATE_BATH_EVENT:
      case BabyCareAction.UPDATE_PLAY_EVENT: {
        const clazz =
          action === BabyCareAction.UPDATE_PLAY_EVENT
            ? PlayEvent
            : action === BabyCareAction.UPDATE_BATH_EVENT
            ? BathEvent
            : action === BabyCareAction.UPDATE_SLEEP_EVENT
            ? SleepEvent
            : undefined;
        const event = await entityManager.findOneOrFail(
          guaranteeNonNullable(clazz),
          { id: eventId }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");

        entityManager.persistAndFlush(event);
        BabyCareDataRegistry.getEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );

        return event;
      }
      default:
        throw new Error(`Unsupported event update action '${action}'`);
    }
  }

  static async removeEvent(action: string, eventId: string) {
    switch (action) {
      case BabyCareAction.REMOVE_BOTTLE_FEED_EVENT:
      case BabyCareAction.REMOVE_PUMPING_EVENT:
      case BabyCareAction.REMOVE_NURSING_EVENT:
      case BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT:
      case BabyCareAction.REMOVE_PLAY_EVENT:
      case BabyCareAction.REMOVE_BATH_EVENT:
      case BabyCareAction.REMOVE_SLEEP_EVENT: {
        const entityManager = await BabyCareDataRegistry.getEntityManager();
        const clazz =
          action === BabyCareAction.REMOVE_BOTTLE_FEED_EVENT
            ? BottleFeedEvent
            : action === BabyCareAction.REMOVE_PUMPING_EVENT
            ? PumpingEvent
            : action === BabyCareAction.REMOVE_NURSING_EVENT
            ? NursingEvent
            : action === BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT
            ? DiaperChangeEvent
            : action === BabyCareAction.REMOVE_PLAY_EVENT
            ? PlayEvent
            : action === BabyCareAction.REMOVE_BATH_EVENT
            ? BathEvent
            : action === BabyCareAction.REMOVE_SLEEP_EVENT
            ? SleepEvent
            : undefined;
        const event = await entityManager.findOneOrFail(
          guaranteeNonNullable(clazz),
          {
            id: eventId,
          }
        );

        await entityManager.removeAndFlush(event);
        BabyCareDataRegistry.getEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );

        return event;
      }
      default:
        throw new Error(`Unsupported event delete action '${action}'`);
    }
  }
}
