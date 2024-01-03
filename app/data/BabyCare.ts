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
  type EntityDTO,
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
  DEFAULT_ENABLE_NOTIFICATION,
} from "./constants";
import EventEmitter from "node:events";
import {
  extractOptionalNumber,
  extractOptionalString,
  extractRequiredBoolean,
  extractRequiredNumber,
  extractRequiredString,
} from "../shared/FormDataUtils";
import { isDuringDaytime } from "./BabyCareUtils";

const HASHER = initHasher({});

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

@Entity()
export class BabyCareProfile {
  // Keep track of hash of event for change detection
  //
  // Shadowed field that should not be persisted to the DB
  // See https://mikro-orm.io/docs/serializing#shadow-properties
  @Property({ type: "string", persist: false })
  HASH!: string;

  @PrimaryKey({ type: "string", unique: true })
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

  // notification
  @Property({ type: "boolean" })
  enableFeedingNotification = DEFAULT_ENABLE_NOTIFICATION;

  @Property({ type: "boolean" })
  enableFeedingReminder = DEFAULT_ENABLE_NOTIFICATION;

  @Property({ type: "boolean" })
  enablePumpingNotification = DEFAULT_ENABLE_NOTIFICATION;

  @Property({ type: "boolean" })
  enablePumpingReminder = DEFAULT_ENABLE_NOTIFICATION;

  @Property({ type: "boolean" })
  enableOtherActivitiesNotification = false; // this would be too noisy so disabled by default

  constructor(name: string, genderAtBirth: Gender, dob: Date) {
    this.name = name;
    this.genderAtBirth = genderAtBirth;
    this.dob = dob;
  }

  get hashCode() {
    return HASHER.hash({
      id: this.id,
      name: this.name,
      genderAtBirth: this.genderAtBirth,
      dob: this.dob,
      handle: this.handle,
      nickname: this.nickname,

      defaultFeedingVolume: this.defaultFeedingVolume,
      defaultFeedingInterval: this.defaultFeedingInterval,
      defaultNightFeedingInterval: this.defaultNightFeedingInterval,

      defaultPumpingDuration: this.defaultPumpingDuration,
      defaultPumpingInterval: this.defaultPumpingInterval,
      defaultNightPumpingInterval: this.defaultNightPumpingInterval,

      babyDaytimeStart: this.babyDaytimeStart,
      babyDaytimeEnd: this.babyDaytimeEnd,
      parentDaytimeStart: this.parentDaytimeStart,
      parentDaytimeEnd: this.parentDaytimeEnd,

      enableFeedingNotification: this.enableFeedingNotification,
      enableFeedingReminder: this.enableFeedingReminder,
      enablePumpingNotification: this.enablePumpingNotification,
      enablePumpingReminder: this.enablePumpingReminder,
      enableOtherActivitiesNotification: this.enableOtherActivitiesNotification,
    });
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
  __FEEDING = "Feeding",
}

export abstract class BabyCareEvent {
  // Keep track of type of event during serialization
  @Property({ type: "string", persist: false })
  TYPE!: string;

  // Keep track of hash of event for change detection
  @Property({ type: "string", persist: false })
  HASH!: string;

  @PrimaryKey({ type: "string", unique: true })
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
  abstract get notificationSummary(): string;

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

  override get notificationSummary() {
    return `Bottlefeed baby ${this.volume}ml`; // TODO: account for unit
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

  override get notificationSummary() {
    return `Breastfeed baby for ${
      (this.leftDuration + this.rightDuration) / (60 * 1000)
    } mins`;
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

  override get notificationSummary() {
    return `Mom pumped ${this.volume}ml`; // TODO: account for unit
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

  override get notificationSummary() {
    return this.poop ? `Poopy diaper` : `Wet diaper`;
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

  override get notificationSummary() {
    return `Baby sleeping`;
  }
}

@Entity()
export class PlayEvent extends BabyCareEvent {
  override get eventType() {
    return BabyCareEventType.PLAY;
  }

  override get notificationSummary() {
    return `Baby playing`;
  }
}

@Entity()
export class BathEvent extends BabyCareEvent {
  override get eventType() {
    return BabyCareEventType.BATH;
  }

  override get notificationSummary() {
    return `Bathing baby`;
  }
}

const BABY_CARE_DB_CONFIG: Options = {
  dbName: "../home-storage/baby-care/db.sqlite",
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
  private static _orm: MikroORM<IDatabaseDriver<Connection>>;

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

    let newProfile = false;
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
      newProfile = true;
    }

    profile.nickname = extractOptionalString(formData, "nickname")?.trim();
    profile.handle = extractOptionalString(formData, "handle")?.trim();

    // feeding
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

    // pumping
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

    // daytime
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

    // notification
    profile.enableFeedingNotification = extractRequiredBoolean(
      formData,
      "enableFeedingNotification"
    );
    profile.enableFeedingReminder = extractRequiredBoolean(
      formData,
      "enableFeedingReminder"
    );
    profile.enablePumpingNotification = extractRequiredBoolean(
      formData,
      "enablePumpingNotification"
    );
    profile.enablePumpingReminder = extractRequiredBoolean(
      formData,
      "enablePumpingReminder"
    );
    profile.enableOtherActivitiesNotification = extractRequiredBoolean(
      formData,
      "enableOtherActivitiesNotification"
    );

    await entityManager.persistAndFlush(profile);
    BabyCareEventManager.getServerEventEmitter().emit(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      profile.id
    );
    if (!newProfile) {
      BabyCareEventManager.notificationService.profileUpdated(profile);
    }

    return { profile, created: newProfile };
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
    BabyCareEventManager.getServerEventEmitter().emit(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      profile.id
    );
    BabyCareEventManager.notificationService.profileRemoved(profile);

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
    BabyCareEventManager.getServerEventEmitter().emit(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      profile.id
    );
    BabyCareEventManager.notificationService.eventCreated(event);

    event.TYPE = event.eventType;
    event.HASH = event.hashCode;

    return event;
  }

  static async updateEvent(formData: FormData, eventId: string) {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const action = formData.get("__action");
    let updatedEvent: BabyCareEvent;

    switch (action) {
      case BabyCareAction.UPDATE_BOTTLE_FEED_EVENT: {
        const event = await entityManager.findOneOrFail(
          BottleFeedEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.volume = extractRequiredNumber(formData, "volume");
        event.formulaMilkVolume = extractOptionalNumber(
          formData,
          "formulaMilkVolume"
        );

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_PUMPING_EVENT: {
        const event = await entityManager.findOneOrFail(
          PumpingEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.volume = extractRequiredNumber(formData, "volume");

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_NURSING_EVENT: {
        const event = await entityManager.findOneOrFail(
          NursingEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.leftDuration = extractRequiredNumber(formData, "leftDuration");
        event.rightDuration = extractRequiredNumber(formData, "rightDuration");

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT: {
        const event = await entityManager.findOneOrFail(
          DiaperChangeEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");
        event.poop = extractRequiredBoolean(formData, "poop");
        event.pee = extractRequiredBoolean(formData, "pee");

        updatedEvent = event;
        break;
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
          { id: eventId },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");

        entityManager.persistAndFlush(event);
        BabyCareEventManager.getServerEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );

        updatedEvent = event;
        break;
      }
      default:
        throw new Error(`Unsupported event update action '${action}'`);
    }

    entityManager.persistAndFlush(updatedEvent);
    BabyCareEventManager.getServerEventEmitter().emit(
      BabyCareServerEvent.PROFILE_DATA_CHANGE,
      updatedEvent.profile.id
    );
    BabyCareEventManager.notificationService.eventUpdated(updatedEvent);

    return updatedEvent;
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
          },
          { populate: ["profile"] }
        );

        await entityManager.removeAndFlush(event);
        BabyCareEventManager.getServerEventEmitter().emit(
          BabyCareServerEvent.PROFILE_DATA_CHANGE,
          event.profile.id
        );
        BabyCareEventManager.notificationService.eventRemoved(event);

        return event;
      }
      default:
        throw new Error(`Unsupported event delete action '${action}'`);
    }
  }
}

abstract class BabyCareEventReminder {
  readonly eventId: string;
  readonly eventTimestamp: number;
  abstract readonly eventType: string;
  readonly profileId: string;

  lastNotifiedTimestamp?: number | undefined;

  constructor(event: BabyCareEvent) {
    this.eventId = event.id;
    this.eventTimestamp = event.time.valueOf();
    this.profileId = event.profile.id;
  }

  abstract generateMessage(durationInAdvance: number): string;
  abstract shouldNotify(profile: EntityDTO<BabyCareProfile>): boolean;
  abstract getNextEventTimestamp(profile: EntityDTO<BabyCareProfile>): number;
}

class FeedingEventReminder extends BabyCareEventReminder {
  override eventType = BabyCareEventType.__FEEDING;
  override generateMessage(durationInAdvance: number) {
    return `Feed baby ${
      durationInAdvance
        ? `in ${durationInAdvance / (60 * 1000)} minutes`
        : "now"
    }`;
  }

  override shouldNotify(profile: EntityDTO<BabyCareProfile>) {
    return profile.enableFeedingReminder;
  }

  override getNextEventTimestamp(profile: EntityDTO<BabyCareProfile>) {
    let nextEventTimestamp =
      this.eventTimestamp + profile.defaultFeedingInterval;
    if (
      isDuringDaytime(
        new Date(nextEventTimestamp),
        profile.babyDaytimeStart,
        profile.babyDaytimeEnd
      )
    ) {
      return nextEventTimestamp;
    }

    nextEventTimestamp =
      this.eventTimestamp + profile.defaultNightFeedingInterval;
    if (
      !isDuringDaytime(
        new Date(nextEventTimestamp),
        profile.babyDaytimeStart,
        profile.babyDaytimeEnd
      )
    ) {
      return nextEventTimestamp;
    }

    // when both daytime and nighttime reminders timing are not valid,
    // potentially due to the profile being configured inappropriately,
    // we simply return a very big number so it will never be fired
    return Number.MAX_SAFE_INTEGER;
  }
}

class PumpingEventReminder extends BabyCareEventReminder {
  override eventType = BabyCareEventType.PUMPING;

  override generateMessage(durationInAdvance: number) {
    return `Pump ${
      durationInAdvance
        ? `in ${durationInAdvance / (60 * 1000)} minutes`
        : "now"
    }`;
  }

  override shouldNotify(profile: EntityDTO<BabyCareProfile>) {
    return profile.enablePumpingReminder;
  }

  override getNextEventTimestamp(profile: EntityDTO<BabyCareProfile>) {
    let nextEventTimestamp =
      this.eventTimestamp + profile.defaultPumpingInterval;
    if (
      isDuringDaytime(
        new Date(nextEventTimestamp),
        profile.parentDaytimeStart,
        profile.parentDaytimeEnd
      )
    ) {
      return nextEventTimestamp;
    }

    nextEventTimestamp =
      this.eventTimestamp + profile.defaultNightPumpingInterval;
    if (
      !isDuringDaytime(
        new Date(nextEventTimestamp),
        profile.parentDaytimeStart,
        profile.parentDaytimeEnd
      )
    ) {
      return nextEventTimestamp;
    }

    // when both daytime and nighttime reminders timing are not valid,
    // potentially due to the profile being configured inappropriately,
    // we simply return a very big number so it will never be fired
    return Number.MAX_SAFE_INTEGER;
  }
}

const serializeProfile = (profile: BabyCareProfile) => {
  const object = wrap(profile).toObject();
  object.HASH = profile.hashCode;
  return object;
};

class BabyCareEventNotificationService {
  private static readonly REMINDER_INTERVAL = 5 * 1000; // 5s
  private static readonly REMINDER_STEPS = [
    0,
    5 * 60 * 1000,
    15 * 60 * 1000,
    30 * 60 * 1000,
  ]; // 30mins, 15mins, 5mins before next event (by interval)

  private readonly notificationWebhookUrl: string | undefined;
  private readonly reminderMentionRoleID: string | undefined;

  private readonly _reminderProfileMap = new Map<
    string,
    EntityDTO<BabyCareProfile>
  >();
  private readonly _reminderEventMap = new Map<string, BabyCareEventReminder>();
  private readonly _reminderLoop: NodeJS.Timeout;

  constructor() {
    const config = JSON.parse(
      readFileSync("../home-storage/home.config.json", { encoding: "utf-8" })
    );
    this.notificationWebhookUrl = returnUndefOnError(() =>
      guaranteeNonEmptyString(config.babyCare.reminderWebhookUrl)
    );
    this.reminderMentionRoleID = returnUndefOnError(() =>
      guaranteeNonEmptyString(config.babyCare.reminderMentionRoleID)
    );

    // This is the reminder loop which run with a specified interval. Every cycle, it checks for all reminders
    // it examines each reminder and attempt to notify the same reminder at different time steps (5 mins 15 mins, 30 mins before)
    // checking one step at a time in receding order (5 mins, then 15 mins, etc.), if the time step is in the future, moves on to the
    // next step
    // when a step is in the past, it will notify this step: record the timestamp of notification and skip all earlier steps
    // of course whether or not the notification is actually sent is determined by the profile
    // note that we will set this timestamp, regardless if the notification was fired or not, as it will be used to indicate the
    // reminder has been sent at that point in time so that if we update the profile/event, we don't send the same reminder again
    this._reminderLoop = setInterval(() => {
      const now = Date.now();
      this._reminderEventMap.forEach((reminder, eventId) => {
        const profile = this._reminderProfileMap.get(reminder.profileId);
        if (!profile) {
          return;
        }

        for (const step of BabyCareEventNotificationService.REMINDER_STEPS) {
          const reminderTime = reminder.getNextEventTimestamp(profile) - step;

          // if the step is prior to the original event timestamp, it doesn't make
          // sense to send this reminder at all
          if (reminderTime <= reminder.eventTimestamp) {
            return;
          }

          // if this reminder already notified to the last step, skip this reminder
          if (
            reminder.lastNotifiedTimestamp &&
            reminder.lastNotifiedTimestamp >= reminderTime
          ) {
            return;
          }

          // if reminder time for this step is in the future, skip to the next step
          if (reminderTime > now) {
            continue;
          }

          if (reminder.shouldNotify(profile)) {
            this.notify(
              `[Reminder] ${profile.nickname ?? profile.name}`,
              reminder.generateMessage(step)
            );
          }

          // even if reminder is not enabled, we still want to update the last notified timestamp
          reminder.lastNotifiedTimestamp = now;
          break;
        }
      });
    }, BabyCareEventNotificationService.REMINDER_INTERVAL);
  }

  private async notify(sender: string, message: string) {
    if (!this.notificationWebhookUrl) {
      return;
    }
    await fetch(this.notificationWebhookUrl, {
      method: HttpMethod.POST,
      headers: {
        [HttpHeader.CONTENT_TYPE]: ContentType.APPLICATION_JSON,
      },
      body: JSON.stringify({
        username: sender,
        // NOTE: Discord has a weird issue that I didn't have time to investigate where
        // webhook bots seem to not be able to raise more than 3 push notifications on IOS
        // e.g. after sending 3 notifications, the 4th will not be shown as push nofication
        // the workaround is to mention roles like @everyone or @here, or some custom role like this
        content: `${
          this.reminderMentionRoleID ? `<@&${this.reminderMentionRoleID}> ` : ""
        }${message}`,
      }),
    });
  }

  private shouldNotifyEvent(event: BabyCareEvent) {
    if (event instanceof BottleFeedEvent || event instanceof NursingEvent) {
      return event.profile.enableFeedingNotification;
    } else if (event instanceof PumpingEvent) {
      return event.profile.enablePumpingNotification;
    }
    return event.profile.enableOtherActivitiesNotification;
  }

  // when a profile is updated, update the profile cache
  // also update the associated event reminders
  async profileUpdated(profile: BabyCareProfile) {
    BabyCareEventManager.notificationService.notify(
      `[Profile] ${profile.nickname ?? profile.name}`,
      `Profile updated`
    );

    this._reminderProfileMap.set(profile.id, serializeProfile(profile));
  }

  // when a profile is removed, remove it from the profile cache
  // and remove all associated event reminders
  async profileRemoved(profile: BabyCareProfile) {
    BabyCareEventManager.notificationService.notify(
      `[Profile] ${profile.nickname ?? profile.name}`,
      `Profile removed! All associated data are also removed.`
    );

    this._reminderProfileMap.delete(profile.id);
    this._reminderEventMap.forEach((reminder) => {
      if (reminder.profileId === profile.id) {
        this._reminderEventMap.delete(reminder.eventId);
      }
    });
  }

  private updateReminderForEvent(event: BabyCareEvent) {
    let reminder: BabyCareEventReminder;
    if (event instanceof BottleFeedEvent || event instanceof NursingEvent) {
      reminder = new FeedingEventReminder(event);
    } else if (event instanceof PumpingEvent) {
      reminder = new PumpingEventReminder(event);
    } else {
      return;
    }

    let currentReminder: BabyCareEventReminder | undefined;
    this._reminderEventMap.forEach((value) => {
      if (value.eventType === reminder.eventType) {
        if (!currentReminder) {
          currentReminder = value;
        } else {
          currentReminder =
            currentReminder.eventTimestamp > value.eventTimestamp
              ? currentReminder
              : value;
        }
        this._reminderEventMap.delete(value.eventId);
      }
    });

    if (!currentReminder) {
      this._reminderEventMap.set(reminder.eventId, reminder);
    } else if (reminder.eventTimestamp > currentReminder.eventTimestamp) {
      if (currentReminder.eventId === reminder.eventId) {
        reminder.lastNotifiedTimestamp = currentReminder.lastNotifiedTimestamp;
      }
      this._reminderEventMap.set(reminder.eventId, reminder);
    }
  }

  // when an event created, add a corresponding reminder if needed
  // also update/cache the associated profile if its notification settings have changed
  // remove events of the same type that are in the past
  async eventCreated(event: BabyCareEvent) {
    if (this.shouldNotifyEvent(event)) {
      BabyCareEventManager.notificationService.notify(
        `[Log] ${event.profile.nickname ?? event.profile.name}`,
        `${event.notificationSummary}`
      );
    }

    // if the event's associated profile has not been cached before or differs
    // from the cache, update the profile cache
    const newProfile = serializeProfile(event.profile);
    if (
      !this._reminderProfileMap.has(event.profile.id) ||
      this._reminderProfileMap.get(event.profile.id)?.HASH !== newProfile.HASH
    ) {
      this._reminderProfileMap.set(event.profile.id, newProfile);
    }

    // add corresponding reminder
    this.updateReminderForEvent(event);
  }

  // when an event is updated, if it's not already registered, it means it's not the latest
  // events of the type that we want to remind, so we'll skip it
  // NOTE: the more thorough check is to check if event of the same type is already registered
  // or not, if not, we will
  async eventUpdated(event: BabyCareEvent) {
    if (this.shouldNotifyEvent(event)) {
      BabyCareEventManager.notificationService.notify(
        `[Update] ${event.profile.nickname ?? event.profile.name}`,
        `${event.notificationSummary}`
      );
    }

    // if the event's associated profile has not been cached before or differs
    // from the cache, update the profile cache
    const newProfile = serializeProfile(event.profile);
    if (
      !this._reminderProfileMap.has(event.profile.id) ||
      this._reminderProfileMap.get(event.profile.id)?.HASH !== newProfile.HASH
    ) {
      this._reminderProfileMap.set(event.profile.id, newProfile);
    }

    // add corresponding reminder
    this.updateReminderForEvent(event);
  }

  // when an event is removed, remove its associated reminder
  async eventRemoved(event: BabyCareEvent) {
    this._reminderEventMap.delete(event.id);
  }
}

export class BabyCareEventManager {
  private static readonly _serverEventEmitter = new EventEmitter();
  public static readonly notificationService =
    new BabyCareEventNotificationService();

  // Facilitate server-sent events (SSE)
  // See https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
  static getServerEventEmitter() {
    return BabyCareEventManager._serverEventEmitter;
  }
}
