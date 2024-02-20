import {
  MikroORM,
  Property,
  ManyToOne,
  TableExistsException,
  wrap,
  type EntityDTO,
  DateTimeType,
  JsonType,
} from "@mikro-orm/core";
import { type SqlEntityManager, SqliteDriver } from "@mikro-orm/sqlite";
import { Entity, PrimaryKey } from "@mikro-orm/core";
import {
  add,
  endOfDay,
  format,
  formatDistanceToNowStrict,
  parseISO,
  startOfDay,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarISOWeeks,
  parse,
  startOfISOWeek,
  startOfMonth,
} from "date-fns";
import { v4 as uuid } from "uuid";
import { hasher as initHasher } from "node-object-hash";
import { readFileSync } from "node:fs";
import {
  getNullableEntry,
  pruneNullValues,
  returnUndefOnError,
} from "../shared/CommonUtils";
import {
  assertTrue,
  guaranteeNonEmptyString,
  guaranteeNonNullable,
  isNumber,
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
  MINIMUM_AUTOCOMPLETE_SEARCH_TEXT_LENGTH,
  UNSPECIFIED_VALUE_TAG,
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

export enum Stage {
  NEWBORN = "NEWBORN",
  NEWBORN_EXCLUSIVE_BOTTLE_FED = "NEWBORN_EXCLUSIVE_BOTTLE_FED",
  INFANT = "INFANT", // > 12m
  TODDLER = "TODDLER",
  PRESCHOOLER = "PRESCHOOLER",
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

  @Property({ type: DateTimeType })
  dob: Date;

  @Property({ type: () => Stage })
  stage = Stage.NEWBORN;

  @Property({ type: "string", nullable: true })
  handle?: string | undefined;

  @Property({ type: "string", nullable: true })
  nickname?: string | undefined;

  @Property({ type: "string", nullable: true })
  dynamicEvent?: string | undefined;

  @Property({ type: JsonType })
  settings = {
    // feeding
    defaultFeedingVolume: DEFAULT_FEEDING_VOLUME,
    defaultFeedingInterval: DEFAULT_FEEDING_INTERVAL,
    defaultNightFeedingInterval: DEFAULT_NIGHT_FEEDING_INTERVAL,
    // pumping
    defaultPumpingDuration: DEFAULT_PUMPING_DURATION, // TODO?: we should consider removing this field
    defaultPumpingInterval: DEFAULT_PUMPING_INTERNAL,
    defaultNightPumpingInterval: DEFAULT_NIGHT_PUMPING_INTERNAL,
    // timing
    babyDaytimeStart: DEFAULT_BABY_DAYTIME_START_HOUR,
    babyDaytimeEnd: DEFAULT_BABY_DAYTIME_END_HOUR,
    parentDaytimeStart: DEFAULT_PARENT_DAYTIME_START_HOUR,
    parentDaytimeEnd: DEFAULT_PARENT_DAYTIME_END_HOUR,
    // notification
    enableFeedingNotification: DEFAULT_ENABLE_NOTIFICATION,
    enableFeedingReminder: DEFAULT_ENABLE_NOTIFICATION,
    enablePumpingNotification: DEFAULT_ENABLE_NOTIFICATION,
    enablePumpingReminder: DEFAULT_ENABLE_NOTIFICATION,
    enableOtherActivitiesNotification: false, // this would be too noisy so disabled by default
  };

  constructor(name: string, genderAtBirth: Gender, dob: Date, stage: Stage) {
    this.name = name;
    this.genderAtBirth = genderAtBirth;
    this.dob = dob;
    this.stage = stage;
  }

  get hashCode() {
    return HASHER.hash({
      id: this.id,
      name: this.name,
      genderAtBirth: this.genderAtBirth,
      dob: this.dob,
      handle: this.handle,
      nickname: this.nickname,
      dynamicEvent: this.dynamicEvent,
      settings: HASHER.hash(this.settings),
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
  MEASUREMENT = "Measure",
  MEDICINE = "Medicine",
  NOTE = "Note",
  TRAVEL = "Travel",

  __POOP = "Poop",
  __PEE = "Pee",
  __FEEDING = "Feeding",
  __MEMORY = "Memory",
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

  @ManyToOne(() => BabyCareProfile, { deleteRule: "cascade" })
  readonly profile: BabyCareProfile;

  @Property({ type: DateTimeType })
  time: Date;

  @Property({ type: "string", nullable: true })
  comment?: string | undefined;

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
      comment: this.comment,
    };
  }

  get hashCode() {
    return HASHER.hash(this.hashContent);
  }
}

@Entity()
export class BottleFeedEvent extends BabyCareEvent {
  @Property({ type: "number", nullable: true })
  duration?: number | undefined;

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
      duration: this.duration,
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
  @Property({ type: "number", nullable: true })
  duration?: number | undefined;

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
      duration: this.duration,
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
  @Property({ type: "number", nullable: true })
  duration?: number | undefined;

  override get eventType() {
    return BabyCareEventType.SLEEP;
  }

  override get notificationSummary() {
    return `Baby sleeping`;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      duration: this.duration,
    });
  }
}

@Entity()
export class PlayEvent extends BabyCareEvent {
  @Property({ type: "number", nullable: true })
  duration?: number | undefined;

  override get eventType() {
    return BabyCareEventType.PLAY;
  }

  override get notificationSummary() {
    return `Baby playing`;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      duration: this.duration,
    });
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

@Entity()
export class MeasurementEvent extends BabyCareEvent {
  @Property({ type: "number", nullable: true })
  height?: number | undefined;

  @Property({ type: "number", nullable: true })
  weight?: number | undefined;

  override get eventType() {
    return BabyCareEventType.MEASUREMENT;
  }

  override get notificationSummary() {
    return `Measuring baby`;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      height: this.height,
      weight: this.weight,
    });
  }
}

@Entity()
export class MedicineEvent extends BabyCareEvent {
  @Property({ type: "string" })
  prescription = UNSPECIFIED_VALUE_TAG;

  override get eventType() {
    return BabyCareEventType.MEDICINE;
  }

  override get notificationSummary() {
    return `Giving baby medicine`;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      prescription: this.prescription,
    });
  }
}

export enum NotePurpose {
  MEMORY = "MEMORY",
}

@Entity()
export class NoteEvent extends BabyCareEvent {
  @Property({ type: "string", nullable: true })
  purpose?: string | undefined;

  override get eventType() {
    return BabyCareEventType.NOTE;
  }

  override get notificationSummary() {
    return this.purpose === NotePurpose.MEMORY
      ? `Jotting down memory`
      : `Making note`;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      purpose: this.purpose,
    });
  }
}

@Entity()
export class TravelEvent extends BabyCareEvent {
  @Property({ type: DateTimeType })
  endTime: Date;

  @Property({ type: "string" })
  destination: string;

  @Property({ type: "string" })
  timeZone: string;

  constructor(
    time: Date,
    profile: BabyCareProfile,
    endTime: Date,
    destination: string,
    timeZone: string
  ) {
    super(time, profile);
    this.endTime = endTime;
    this.destination = destination;
    this.timeZone = timeZone;
  }

  override get eventType() {
    return BabyCareEventType.TRAVEL;
  }

  override get notificationSummary() {
    return `Traveling`;
  }

  override get hashCode() {
    return HASHER.hash({
      ...this.hashContent,
      endTime: this.endTime,
      destination: this.destination,
      timeZone: this.timeZone,
    });
  }
}

export enum BabyCareEventTimeSeriesStatsFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}

export enum BabyCareEventTimeSeriesStatsRange {
  ONE_WEEK = "1W",
  ONE_MONTH = "1M",
  THREE_MONTH = "3M",
  SIX_MONTH = "6M",
  YTD = "YTD",
  ONE_YEAR = "1Y",
  MAX = "MAX",
}

export interface BabyCareEventTimeSeriesStatsRecord {
  t_raw: string;
  t_label: string;
  t_diff: number;
  t_diff_label: string;

  t_min: number;
  t_max: number;
  t_no_day: number;

  is_traveling: boolean;

  count: number;
}

export interface BottleFeedEventTimeSeriesStatsRecord
  extends BabyCareEventTimeSeriesStatsRecord {
  sum_volume: number;
  avg_volume: number;
  daily_avg_volume: number;
  sum_formula_milk_volume: number;
  avg_formula_milk_volume: number;
  daily_avg_formula_milk_volume: number;
}

export interface PumpingEventTimeSeriesStatsRecord
  extends BabyCareEventTimeSeriesStatsRecord {
  sum_volume: number;
  avg_volume: number;
  daily_avg_volume: number;
}

export interface NursingEventTimeSeriesStatsRecord
  extends BabyCareEventTimeSeriesStatsRecord {
  sum_duration: number;
  avg_duration: number;
  daily_avg_duration: number;
}

export interface BabyCareEventStats {
  records: object[];
}

export interface BabyCareEventTimeSeriesStats extends BabyCareEventStats {
  records: BabyCareEventTimeSeriesStatsRecord[];
  current_t_diff: number;
}

export enum BabyCareAction {
  CREATE_PROFILE = "baby-care.profile.create",
  UPDATE_PROFILE = "baby-care.profile.update",
  REMOVE_PROFILE = "baby-care.profile.remove",

  REQUEST_ASSISTANT = "baby-care.assistant.request",
  NOTIFY_MESSAGE = "baby-care.notification.notify-message",

  EDIT_GENERIC_EVENT = "baby-care.event.generic-edit",
  CREATE_DYNAMIC_EVENT = "baby-care.dynamic-event.create",

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

  CREATE_MEASUREMENT_EVENT = "baby-care.measurement-event.create",
  UPDATE_MEASUREMENT_EVENT = "baby-care.measurement-event.update",
  REMOVE_MEASUREMENT_EVENT = "baby-care.measurement-event.remove",

  CREATE_MEDICINE_EVENT = "baby-care.medicine-event.create",
  UPDATE_MEDICINE_EVENT = "baby-care.medicine-event.update",
  REMOVE_MEDICINE_EVENT = "baby-care.medicine-event.remove",

  CREATE_NOTE_EVENT = "baby-care.note-event.create",
  UPDATE_NOTE_EVENT = "baby-care.note-event.update",
  REMOVE_NOTE_EVENT = "baby-care.note-event.remove",

  CREATE_TRAVEL_EVENT = "baby-care.travel-event.create",
  UPDATE_TRAVEL_EVENT = "baby-care.travel-event.update",
  REMOVE_TRAVEL_EVENT = "baby-care.travel-event.remove",

  FETCH_TOP_PRESCRIPTIONS = "baby-care.fetch-top-prescriptions",
}

export enum BabyCareServerEvent {
  PROFILE_DATA_CHANGE = "baby-care.profile-data-change",
}

const getBabyCareConfig = () =>
  guaranteeNonNullable(
    JSON.parse(
      readFileSync("../home-storage/home.config.json", { encoding: "utf-8" })
    ).babyCare
  );

export class BabyCareDataRegistry {
  private static _orm: MikroORM<SqliteDriver>;

  static async getORM(): Promise<MikroORM<SqliteDriver>> {
    const config = getBabyCareConfig();
    const dbPath = config.dbPath;
    if (!dbPath) {
      throw new Error(
        "Database is not found. Please specify 'babyCare.dbPath' in the config file"
      );
    }

    if (!BabyCareDataRegistry._orm) {
      const orm = await MikroORM.init<SqliteDriver>({
        dbName: dbPath,
        driver: SqliteDriver,
        entities: [
          BabyCareProfile,
          BottleFeedEvent,
          NursingEvent,
          PumpingEvent,
          DiaperChangeEvent,
          SleepEvent,
          PlayEvent,
          BathEvent,
          MeasurementEvent,
          MedicineEvent,
          NoteEvent,
          TravelEvent,
        ],
        discovery: { disableDynamicFileAccess: true },
      });
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

  static async getEntityManager(): Promise<SqlEntityManager> {
    return (await BabyCareDataRegistry.getORM()).em.fork();
  }

  static async fetchProfiles(): Promise<BabyCareProfile[]> {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const profiles = await entityManager
      .getRepository(BabyCareProfile)
      .findAll();
    return profiles;
  }

  // NOTE: it's important to use `startOfDay` since it will convert the temporal value into local time
  // and since all logging is done with local time, the filters will be applied accordingly
  static async fetchEvents(profile: BabyCareProfile, date: Date) {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const events: BabyCareEvent[] = (
      await Promise.all([
        entityManager.find(BottleFeedEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(NursingEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(PumpingEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(DiaperChangeEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(SleepEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(BathEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(PlayEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(MeasurementEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(MedicineEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(NoteEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
        }),
        entityManager.find(TravelEvent, {
          profile,
          time: {
            $gte: startOfDay(date),
            $lt: startOfDay(add(date, { days: 1 })),
          },
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

  static async lookupEvents(
    profile: BabyCareProfile,
    eventType: string,
    pageSize: number,
    page: number,
    options: {
      startDate?: Date | undefined;
      endDate?: Date | undefined;
      searchText?: string | undefined;
    }
  ): Promise<{ events: BabyCareEvent[]; totalCount: number }> {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    let result: [BabyCareEvent[], number] = [[], 0];
    switch (eventType.toLowerCase()) {
      case BabyCareEventType.BOTTLE_FEED.toLowerCase(): {
        result = await entityManager.findAndCount(
          BottleFeedEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.PUMPING.toLowerCase(): {
        result = await entityManager.findAndCount(
          PumpingEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.NURSING.toLowerCase(): {
        result = await entityManager.findAndCount(
          NursingEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.__POOP.toLowerCase(): {
        result = await entityManager.findAndCount(
          DiaperChangeEvent,
          {
            profile,
            poop: true,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.__PEE.toLowerCase(): {
        result = await entityManager.findAndCount(
          DiaperChangeEvent,
          {
            profile,
            poop: false,
            pee: true,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.BATH.toLowerCase(): {
        result = await entityManager.findAndCount(
          BathEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.PLAY.toLowerCase(): {
        result = await entityManager.findAndCount(
          PlayEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.SLEEP.toLowerCase(): {
        result = await entityManager.findAndCount(
          SleepEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.MEASUREMENT.toLowerCase(): {
        result = await entityManager.findAndCount(
          MeasurementEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.MEDICINE.toLowerCase(): {
        result = await entityManager.findAndCount(
          MedicineEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            $or: options?.searchText
              ? [
                  {
                    comment: {
                      $like: `%${options.searchText}%`,
                    },
                  },
                  {
                    prescription: {
                      $like: `%${options.searchText}%`,
                      $ne: UNSPECIFIED_VALUE_TAG,
                    },
                  },
                ]
              : [],
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.NOTE.toLowerCase():
      case BabyCareEventType.__MEMORY.toLowerCase(): {
        result = await entityManager.findAndCount(
          NoteEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            purpose:
              eventType === BabyCareEventType.__MEMORY
                ? NotePurpose.MEMORY
                : null,
            comment: options?.searchText
              ? {
                  $like: `%${options.searchText}%`,
                }
              : {},
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      case BabyCareEventType.TRAVEL.toLowerCase(): {
        result = await entityManager.findAndCount(
          TravelEvent,
          {
            profile,
            time: pruneNullValues({
              $gte: options?.startDate ? startOfDay(options?.startDate) : null,
              $lte: options?.endDate ? endOfDay(options?.endDate) : null,
            }),
            $or: options?.searchText
              ? [
                  {
                    comment: {
                      $like: `%${options.searchText}%`,
                    },
                  },
                  {
                    destination: {
                      $like: `%${options.searchText}%`,
                      $ne: UNSPECIFIED_VALUE_TAG,
                    },
                  },
                ]
              : [],
          },
          {
            limit: pageSize,
            offset: pageSize * Math.max(0, page - 1),
            orderBy: { time: "DESC" },
          }
        );
        break;
      }
      default: {
        break;
      }
    }

    return {
      events: result[0].map((event) =>
        wrap(event).assign({
          TYPE: event.eventType,
          HASH: event.hashCode,
        })
      ),
      totalCount: result[1],
    };
  }

  static async getStats(
    profile: BabyCareProfile,
    eventType: string,
    frequency: string,
    options: {
      startDate?: Date | undefined;
      endDate?: Date | undefined;
    }
  ): Promise<BabyCareEventStats> {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const connection = entityManager.getConnection();
    const knex = connection.getKnex();

    let result: BabyCareEventStats = {
      records: [],
    };

    // time series stats
    let timeGroupByFieldFormat: string;
    let recordTimeProcessor: (
      record: BabyCareEventTimeSeriesStatsRecord
    ) => BabyCareEventTimeSeriesStatsRecord;

    const travel_metadata = entityManager.getMetadata(TravelEvent);
    const _travel_profile_id = guaranteeNonNullable(
      travel_metadata.properties.profile.fieldNames[0]
    );
    const _travel_startTime = guaranteeNonNullable(
      travel_metadata.properties.time.fieldNames[0]
    );
    const _travel_endTime = guaranteeNonNullable(
      travel_metadata.properties.endTime.fieldNames[0]
    );
    const _travel_timeZone = guaranteeNonNullable(
      travel_metadata.properties.timeZone.fieldNames[0]
    );
    const _travel_current_time_zone =
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    switch (frequency.toLowerCase()) {
      case BabyCareEventTimeSeriesStatsFrequency.DAILY.toLowerCase(): {
        timeGroupByFieldFormat = "%Y-%m-%d";
        recordTimeProcessor = (record) => {
          const date = parseISO(record.t_raw);
          const diff = differenceInCalendarDays(
            startOfDay(date),
            startOfDay(profile.dob)
          );
          return {
            ...record,
            t_label: format(date, "dd MMM yyyy"),
            t_diff: diff,
            t_diff_label: `Day ${diff}`,
            is_traveling: (record.is_traveling as unknown as number) === 1,
          };
        };
        break;
      }
      case BabyCareEventTimeSeriesStatsFrequency.WEEKLY.toLowerCase(): {
        // NOTE: SQLite %W refer to ISO-8601 week number of the year, i.e. week starts on Monday
        timeGroupByFieldFormat = "%Y-%W";
        recordTimeProcessor = (record) => {
          // Parsing the week in ISO-8601 format requires special date-fns config
          const weekFirstDate = parse(record.t_raw, "RRRR-II", new Date(), {
            useAdditionalWeekYearTokens: true,
          });
          const diff = differenceInCalendarISOWeeks(
            weekFirstDate,
            startOfISOWeek(profile.dob)
          );
          return {
            ...record,
            t_label: `${format(weekFirstDate, "dd MMM yyyy")}`, // for brevity, only show the first day of the week
            t_diff: diff,
            t_diff_label: `Week ${diff}`,
            is_traveling: (record.is_traveling as unknown as number) === 1,
          };
        };
        break;
      }
      case BabyCareEventTimeSeriesStatsFrequency.MONTHLY.toLowerCase(): {
        timeGroupByFieldFormat = "%Y-%m";
        recordTimeProcessor = (record) => {
          const monthFirstDate = parseISO(`${record.t_raw}-01`);
          const diff = differenceInCalendarMonths(
            monthFirstDate,
            startOfMonth(profile.dob)
          );
          return {
            ...record,
            t_label: format(monthFirstDate, "MMM yyyy"),
            t_diff: diff,
            t_diff_label: `Month ${diff}`,
            is_traveling: (record.is_traveling as unknown as number) === 1,
          };
        };
        break;
      }
      default: {
        return result;
      }
    }

    let current_t_diff: number;
    switch (frequency.toLowerCase()) {
      case BabyCareEventTimeSeriesStatsFrequency.DAILY.toLowerCase(): {
        current_t_diff = differenceInCalendarDays(
          startOfDay(new Date()),
          profile.dob
        );
        break;
      }
      case BabyCareEventTimeSeriesStatsFrequency.WEEKLY.toLowerCase(): {
        current_t_diff = differenceInCalendarISOWeeks(
          startOfISOWeek(new Date()),
          startOfISOWeek(profile.dob)
        );
        break;
      }
      case BabyCareEventTimeSeriesStatsFrequency.MONTHLY.toLowerCase(): {
        current_t_diff = differenceInCalendarMonths(
          startOfMonth(new Date()),
          startOfMonth(profile.dob)
        );
        break;
      }
      default: {
        current_t_diff = -1;
      }
    }

    switch (eventType.toLowerCase()) {
      case BabyCareEventType.BOTTLE_FEED.toLowerCase(): {
        const metadata = entityManager.getMetadata(BottleFeedEvent);
        const _profile_id = guaranteeNonNullable(
          metadata.properties.profile.fieldNames[0]
        );
        const _time = guaranteeNonNullable(
          metadata.properties.time.fieldNames[0]
        );
        const _volume = guaranteeNonNullable(
          metadata.properties.volume.fieldNames[0]
        );
        const _formula_milk_volume = guaranteeNonNullable(
          metadata.properties.formulaMilkVolume.fieldNames[0]
        );
        const queryBuilder = knex
          .from(metadata.tableName)
          .where(_profile_id, profile.id);
        if (options.startDate) {
          queryBuilder.andWhere(
            _time,
            ">=",
            startOfDay(options.startDate).valueOf()
          );
        }
        if (options.endDate) {
          queryBuilder.andWhere(
            _time,
            "<",
            endOfDay(options.endDate).valueOf()
          );
        }

        queryBuilder
          .select(
            knex.raw(
              `STRFTIME('${timeGroupByFieldFormat}', DATE(CAST(${_time}/1000 as int), 'unixepoch', 'localtime')) as t_raw`
            ),
            knex.raw(
              `COUNT(DISTINCT(STRFTIME('%Y-%m-%d', DATE(CAST(${_time}/1000 as int), 'unixepoch', 'localtime')))) as t_no_day`
            ),
            // NOTE: this might be a little to expensive, but might be appropriate for the scale of this app
            // we can defnitely do a post-processing to optimize and calculate it, but it's probably not worth the complexity at the moment
            knex.raw(
              `MAX(EXISTS(SELECT * FROM ${travel_metadata.tableName} WHERE ${_travel_profile_id} = '${profile.id}' AND ${_travel_startTime} <= ${metadata.tableName}.${_time} AND ${_travel_endTime} >= ${metadata.tableName}.${_time} AND ${_travel_timeZone} != '${_travel_current_time_zone}' LIMIT 1)) as is_traveling`
            ),
            knex.raw(`COUNT(*) as count`),
            knex.min(_time).as("t_min"),
            knex.max(_time).as("t_max"),
            knex.sum(_volume).as("sum_volume"),
            knex.raw(`ROUND(AVG(${_volume})) as avg_volume`),
            knex.sum(_formula_milk_volume).as("sum_formula_milk_volume"),
            knex.raw(
              `ROUND(AVG(${_formula_milk_volume})) as avg_formula_milk_volume`
            )
          )
          .groupBy("t_raw")
          .orderBy("t_raw", "ASC");
        result = {
          records: (await queryBuilder).map((item) => {
            const record = recordTimeProcessor(
              item
            ) as BottleFeedEventTimeSeriesStatsRecord;
            return {
              ...record,
              daily_avg_volume: isNumber(record.sum_volume)
                ? Math.round(record.sum_volume / record.t_no_day)
                : null,
              daily_avg_formula_milk_volume: isNumber(
                record.sum_formula_milk_volume
              )
                ? Math.round(record.sum_formula_milk_volume / record.t_no_day)
                : null,
            } as BottleFeedEventTimeSeriesStatsRecord;
          }),
          current_t_diff,
        } as BabyCareEventTimeSeriesStats;
        break;
      }
      case BabyCareEventType.PUMPING.toLowerCase(): {
        const metadata = entityManager.getMetadata(PumpingEvent);
        const _profile_id = guaranteeNonNullable(
          metadata.properties.profile.fieldNames[0]
        );
        const _time = guaranteeNonNullable(
          metadata.properties.time.fieldNames[0]
        );
        const _volume = guaranteeNonNullable(
          metadata.properties.volume.fieldNames[0]
        );
        const queryBuilder = knex
          .from(metadata.tableName)
          .where(_profile_id, profile.id);
        if (options.startDate) {
          queryBuilder.andWhere(
            _time,
            ">=",
            startOfDay(options.startDate).valueOf()
          );
        }
        if (options.endDate) {
          queryBuilder.andWhere(
            _time,
            "<",
            endOfDay(options.endDate).valueOf()
          );
        }
        queryBuilder
          .select(
            knex.raw(
              `STRFTIME('${timeGroupByFieldFormat}', DATE(CAST(${_time}/1000 as int), 'unixepoch', 'localtime')) as t_raw`
            ),
            knex.raw(
              `COUNT(DISTINCT(STRFTIME('%Y-%m-%d', DATE(CAST(${_time}/1000 as int), 'unixepoch', 'localtime')))) as t_no_day`
            ),
            // NOTE: this might be a little to expensive, but might be appropriate for the scale of this app
            // we can defnitely do a post-processing to optimize and calculate it, but it's probably not worth the complexity at the moment
            knex.raw(
              `MAX(EXISTS(SELECT * FROM ${travel_metadata.tableName} WHERE ${_travel_profile_id} = '${profile.id}' AND ${_travel_startTime} <= ${metadata.tableName}.${_time} AND ${_travel_endTime} >= ${metadata.tableName}.${_time} AND ${_travel_timeZone} != '${_travel_current_time_zone}' LIMIT 1)) as is_traveling`
            ),
            knex.raw(`COUNT(*) as count`),
            knex.min(_time).as("t_min"),
            knex.max(_time).as("t_max"),
            knex.sum(_volume).as("sum_volume"),
            knex.raw(`ROUND(AVG(${_volume})) as avg_volume`)
          )
          .groupBy("t_raw")
          .orderBy("t_raw", "ASC");
        result = {
          records: (await queryBuilder).map((item) => {
            const record = recordTimeProcessor(
              item
            ) as PumpingEventTimeSeriesStatsRecord;
            return {
              ...record,
              daily_avg_volume: isNumber(record.sum_volume)
                ? Math.round(record.sum_volume / record.t_no_day)
                : null,
            } as PumpingEventTimeSeriesStatsRecord;
          }),
          current_t_diff,
        } as BabyCareEventTimeSeriesStats;
        break;
      }
      case BabyCareEventType.NURSING.toLowerCase(): {
        const metadata = entityManager.getMetadata(NursingEvent);
        const _profile_id = guaranteeNonNullable(
          metadata.properties.profile.fieldNames[0]
        );
        const _time = guaranteeNonNullable(
          metadata.properties.time.fieldNames[0]
        );
        const _left_duration = guaranteeNonNullable(
          metadata.properties.leftDuration.fieldNames[0]
        );
        const _right_duration = guaranteeNonNullable(
          metadata.properties.rightDuration.fieldNames[0]
        );
        const queryBuilder = knex
          .from(metadata.tableName)
          .where(_profile_id, profile.id);
        if (options.startDate) {
          queryBuilder.andWhere(
            _time,
            ">=",
            startOfDay(options.startDate).valueOf()
          );
        }
        if (options.endDate) {
          queryBuilder.andWhere(
            _time,
            "<",
            endOfDay(options.endDate).valueOf()
          );
        }
        queryBuilder
          .select(
            knex.raw(
              `STRFTIME('${timeGroupByFieldFormat}', DATE(CAST(${_time}/1000 as int), 'unixepoch', 'localtime')) as t_raw`
            ),
            knex.raw(
              `COUNT(DISTINCT(STRFTIME('%Y-%m-%d', DATE(CAST(${_time}/1000 as int), 'unixepoch', 'localtime')))) as t_no_day`
            ),
            // NOTE: this might be a little to expensive, but might be appropriate for the scale of this app
            // we can defnitely do a post-processing to optimize and calculate it, but it's probably not worth the complexity at the moment
            knex.raw(
              `MAX(EXISTS(SELECT * FROM ${travel_metadata.tableName} WHERE ${_travel_profile_id} = '${profile.id}' AND ${_travel_startTime} <= ${metadata.tableName}.${_time} AND ${_travel_endTime} >= ${metadata.tableName}.${_time} AND ${_travel_timeZone} != '${_travel_current_time_zone}' LIMIT 1)) as is_traveling`
            ),
            knex.raw(`COUNT(*) as count`),
            knex.min(_time).as("t_min"),
            knex.max(_time).as("t_max"),
            knex.raw(
              `ROUND(SUM(${_left_duration} + ${_right_duration})/3600000.0, 1) as sum_duration`
            ),
            knex.raw(
              `ROUND(AVG(${_left_duration} + ${_right_duration})/3600000.0, 1) as avg_duration`
            )
          )
          .groupBy("t_raw")
          .orderBy("t_raw", "ASC");
        result = {
          records: (await queryBuilder).map((item) => {
            const record = recordTimeProcessor(
              item
            ) as NursingEventTimeSeriesStatsRecord;
            return {
              ...record,
              daily_avg_duration: isNumber(record.sum_duration)
                ? record.sum_duration / record.t_no_day
                : null,
            } as NursingEventTimeSeriesStatsRecord;
          }),
          current_t_diff,
        } as BabyCareEventTimeSeriesStats;
        break;
      }
      default: {
        break;
      }
    }

    return result;
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
    const stage = Stage[extractRequiredString(formData, "stage") as Stage];

    if (id) {
      profile = await entityManager.findOneOrFail(BabyCareProfile, {
        id: id as string,
      });
      profile.name = name;
      profile.dob = dob;
      profile.genderAtBirth = gender;
      profile.stage = stage;
    } else {
      profile = new BabyCareProfile(name, gender, dob, stage);
      newProfile = true;
    }

    profile.nickname = extractOptionalString(formData, "nickname")?.trim();
    profile.handle = extractOptionalString(formData, "handle")?.trim();

    // feeding
    profile.settings.defaultFeedingVolume = extractRequiredNumber(
      formData,
      "defaultFeedingVolume"
    );
    profile.settings.defaultFeedingInterval = extractRequiredNumber(
      formData,
      "defaultFeedingInterval"
    );
    profile.settings.defaultNightFeedingInterval = extractRequiredNumber(
      formData,
      "defaultNightFeedingInterval"
    );

    // pumping
    profile.settings.defaultPumpingDuration = extractRequiredNumber(
      formData,
      "defaultPumpingDuration"
    );
    profile.settings.defaultPumpingInterval = extractRequiredNumber(
      formData,
      "defaultPumpingInterval"
    );
    profile.settings.defaultNightPumpingInterval = extractRequiredNumber(
      formData,
      "defaultNightPumpingInterval"
    );

    // daytime
    profile.settings.babyDaytimeStart = extractRequiredNumber(
      formData,
      "babyDaytimeStart"
    );
    profile.settings.babyDaytimeEnd = extractRequiredNumber(
      formData,
      "babyDaytimeEnd"
    );
    profile.settings.parentDaytimeStart = extractRequiredNumber(
      formData,
      "parentDaytimeStart"
    );
    profile.settings.parentDaytimeEnd = extractRequiredNumber(
      formData,
      "parentDaytimeEnd"
    );

    // notification
    profile.settings.enableFeedingNotification = extractRequiredBoolean(
      formData,
      "enableFeedingNotification"
    );
    profile.settings.enableFeedingReminder = extractRequiredBoolean(
      formData,
      "enableFeedingReminder"
    );
    profile.settings.enablePumpingNotification = extractRequiredBoolean(
      formData,
      "enablePumpingNotification"
    );
    profile.settings.enablePumpingReminder = extractRequiredBoolean(
      formData,
      "enablePumpingReminder"
    );
    profile.settings.enableOtherActivitiesNotification = extractRequiredBoolean(
      formData,
      "enableOtherActivitiesNotification"
    );

    profile.dynamicEvent = extractOptionalString(formData, "dynamicEvent");

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
      case BabyCareAction.CREATE_DYNAMIC_EVENT: {
        if (profile.dynamicEvent) {
          event = await BabyCareDataRegistry.quickCreateEvent(
            profile.dynamicEvent,
            profile.id
          );
          break;
        }
      }
      case BabyCareAction.CREATE_BOTTLE_FEED_EVENT: {
        event = new BottleFeedEvent(
          new Date(),
          profile,
          profile.settings.defaultFeedingVolume
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
        quickEvent.volume = profile.settings.defaultFeedingVolume;
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
      case BabyCareAction.CREATE_MEASUREMENT_EVENT: {
        const quickEvent = new MeasurementEvent(new Date(), profile);
        const lastMeasurementWithHeight = await entityManager.findOne(
          MeasurementEvent,
          { profile, height: { $ne: null } },
          { orderBy: { time: "DESC" } }
        );
        quickEvent.height = lastMeasurementWithHeight?.height;
        const lastMeasurementWithWeight = await entityManager.findOne(
          MeasurementEvent,
          { profile, weight: { $ne: null } },
          { orderBy: { time: "DESC" } }
        );
        quickEvent.weight = lastMeasurementWithWeight?.weight;
        event = quickEvent;
        break;
      }
      case BabyCareAction.CREATE_MEDICINE_EVENT: {
        event = new MedicineEvent(new Date(), profile);
        break;
      }
      case BabyCareAction.CREATE_NOTE_EVENT: {
        event = new NoteEvent(new Date(), profile);
        break;
      }
      case BabyCareAction.CREATE_TRAVEL_EVENT: {
        const now = new Date();
        event = new TravelEvent(
          now,
          profile,
          now,
          UNSPECIFIED_VALUE_TAG,
          Intl.DateTimeFormat().resolvedOptions().timeZone
        );
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
        event.poop = extractRequiredBoolean(formData, "poop");
        event.pee = extractRequiredBoolean(formData, "pee");

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_SLEEP_EVENT: {
        const event = await entityManager.findOneOrFail(
          SleepEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_BATH_EVENT: {
        const event = await entityManager.findOneOrFail(
          BathEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_PLAY_EVENT: {
        const event = await entityManager.findOneOrFail(
          PlayEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.duration = extractOptionalNumber(formData, "duration");

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_MEASUREMENT_EVENT: {
        const event = await entityManager.findOneOrFail(
          MeasurementEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.height = extractOptionalNumber(formData, "height");
        event.weight = extractOptionalNumber(formData, "weight");

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_MEDICINE_EVENT: {
        const event = await entityManager.findOneOrFail(
          MedicineEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.prescription = extractRequiredString(
          formData,
          "prescription"
        ).trim();

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_NOTE_EVENT: {
        const event = await entityManager.findOneOrFail(
          NoteEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.purpose = extractOptionalString(formData, "purpose")?.trim();
        event.comment = extractOptionalString(formData, "comment")?.trim();

        updatedEvent = event;
        break;
      }
      case BabyCareAction.UPDATE_TRAVEL_EVENT: {
        const event = await entityManager.findOneOrFail(
          TravelEvent,
          {
            id: eventId,
          },
          { populate: ["profile"] }
        );

        event.time = new Date(extractRequiredString(formData, "time"));
        event.endTime = new Date(extractRequiredString(formData, "endTime"));
        event.comment = extractOptionalString(formData, "comment")?.trim();
        event.destination = extractRequiredString(
          formData,
          "destination"
        ).trim();
        event.timeZone = extractRequiredString(formData, "timeZone").trim();

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
      case BabyCareAction.REMOVE_SLEEP_EVENT:
      case BabyCareAction.REMOVE_MEASUREMENT_EVENT:
      case BabyCareAction.REMOVE_MEDICINE_EVENT:
      case BabyCareAction.REMOVE_NOTE_EVENT:
      case BabyCareAction.REMOVE_TRAVEL_EVENT: {
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
            : action === BabyCareAction.REMOVE_MEASUREMENT_EVENT
            ? MeasurementEvent
            : action === BabyCareAction.REMOVE_MEDICINE_EVENT
            ? MedicineEvent
            : action === BabyCareAction.REMOVE_NOTE_EVENT
            ? NoteEvent
            : action === BabyCareAction.REMOVE_TRAVEL_EVENT
            ? TravelEvent
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

  static async fetchTopPrescriptions(
    profileId: string,
    searchText: string | undefined
  ): Promise<string[]> {
    const entityManager = await BabyCareDataRegistry.getEntityManager();
    const events = await entityManager.find(
      MedicineEvent,
      searchText?.length &&
        searchText.length >= MINIMUM_AUTOCOMPLETE_SEARCH_TEXT_LENGTH
        ? {
            profile: profileId,
            prescription: {
              $like: `%${searchText}%`,
              $ne: UNSPECIFIED_VALUE_TAG,
            },
          }
        : {
            profile: profileId,
          },
      {
        limit: 10,
        groupBy: ["prescription"],
      }
    );

    return events.map((event) => event.prescription);
  }
}

abstract class BabyCareEventReminder {
  readonly eventId: string;
  abstract readonly eventType: string;
  readonly profileId: string;

  eventTimestamp: number;
  lastNotifiedTimestamp?: number | undefined;

  constructor(event: BabyCareEvent) {
    this.eventId = event.id;
    this.eventTimestamp = event.time.valueOf();
    this.profileId = event.profile.id;
  }

  abstract generateMessage(durationInAdvance: number): string;
  abstract shouldNotify(profile: EntityDTO<BabyCareProfile>): boolean;
  abstract getTimingConfiguration(profile: EntityDTO<BabyCareProfile>): {
    daytimeInterval: number;
    nighttimeInterval: number;
    daytimeStart: number;
    daytimeEnd: number;
  };

  getNextEventTimestamp(
    profile: EntityDTO<BabyCareProfile>
  ): number | undefined {
    const { daytimeInterval, nighttimeInterval, daytimeStart, daytimeEnd } =
      this.getTimingConfiguration(profile);
    if (
      isDuringDaytime(new Date(this.eventTimestamp), daytimeStart, daytimeEnd)
    ) {
      if (!daytimeInterval) {
        return undefined;
      }
    } else {
      if (!nighttimeInterval) {
        return undefined;
      }
    }

    let nextEventTimestamp = this.eventTimestamp + daytimeInterval;
    if (
      isDuringDaytime(new Date(nextEventTimestamp), daytimeStart, daytimeEnd)
    ) {
      return nextEventTimestamp;
    }

    nextEventTimestamp = this.eventTimestamp + nighttimeInterval;
    if (
      !isDuringDaytime(new Date(nextEventTimestamp), daytimeStart, daytimeEnd)
    ) {
      return nextEventTimestamp;
    }

    return undefined;
  }
}

class FeedingEventReminder extends BabyCareEventReminder {
  override eventType = BabyCareEventType.__FEEDING;
  override generateMessage(durationInAdvance: number) {
    return `Feed baby ${
      durationInAdvance
        ? `in ${durationInAdvance / (60 * 1000)} minutes`
        : "now"
    } (last fed ${formatDistanceToNowStrict(this.eventTimestamp)} ago)`;
  }

  override shouldNotify(profile: EntityDTO<BabyCareProfile>) {
    return profile.settings.enableFeedingReminder;
  }

  override getTimingConfiguration(profile: EntityDTO<BabyCareProfile>) {
    return {
      daytimeInterval: profile.settings.defaultFeedingInterval,
      nighttimeInterval: profile.settings.defaultNightFeedingInterval,
      daytimeStart: profile.settings.babyDaytimeStart,
      daytimeEnd: profile.settings.babyDaytimeEnd,
    };
  }
}

class PumpingEventReminder extends BabyCareEventReminder {
  override eventType = BabyCareEventType.PUMPING;

  override generateMessage(durationInAdvance: number) {
    return `Pump ${
      durationInAdvance
        ? `in ${durationInAdvance / (60 * 1000)} minutes`
        : "now"
    } (last pumped ${formatDistanceToNowStrict(this.eventTimestamp)} ago)`;
  }

  override shouldNotify(profile: EntityDTO<BabyCareProfile>) {
    return profile.settings.enablePumpingReminder;
  }

  override getTimingConfiguration(profile: EntityDTO<BabyCareProfile>) {
    return {
      daytimeInterval: profile.settings.defaultPumpingInterval,
      nighttimeInterval: profile.settings.defaultNightPumpingInterval,
      daytimeStart: profile.settings.parentDaytimeStart,
      daytimeEnd: profile.settings.parentDaytimeEnd,
    };
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

  private readonly requestAssistantUrl: string | undefined;
  private readonly notifierWebhookUrl: string | undefined;
  private readonly notifierWebhookDebugUrl: string | undefined;
  private readonly notifierWebhookMentionRoleID: string | undefined;

  private readonly _reminderProfileMap = new Map<
    string,
    EntityDTO<BabyCareProfile>
  >();
  private readonly _reminderEventMap = new Map<string, BabyCareEventReminder>();
  private readonly _reminderLoop: NodeJS.Timeout;

  constructor() {
    const config = getBabyCareConfig();
    this.requestAssistantUrl = returnUndefOnError(() =>
      guaranteeNonEmptyString(config.requestAssistantUrl)
    );
    this.notifierWebhookUrl =
      process.env.NOTIFIER_WEBHOOK_URL ??
      returnUndefOnError(() =>
        guaranteeNonEmptyString(config.notifierWebhook.url)
      );
    this.notifierWebhookDebugUrl = returnUndefOnError(() =>
      guaranteeNonEmptyString(config.notifierWebhook.debugUrl)
    );
    this.notifierWebhookMentionRoleID = returnUndefOnError(() =>
      guaranteeNonEmptyString(config.notifierWebhook.mentionRoleID)
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

        const nextEventTimestamp = reminder.getNextEventTimestamp(profile);

        // if the next event timestamp cannot be computed, or the next event timestamp is in the past, skip this reminder
        if (!nextEventTimestamp || nextEventTimestamp < now) {
          return;
        }

        for (const step of BabyCareEventNotificationService.REMINDER_STEPS) {
          const reminderTime = nextEventTimestamp - step;

          // if the step is prior to the original event timestamp, it doesn't make
          // sense to send this reminder at all, this could happen when the interval
          // used to construct the next event timestamp is too little
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
            const sender = `[Reminder] ${profile.nickname ?? profile.name}`;
            const message = reminder.generateMessage(step);
            this.notify(sender, message);
            this.notifyDebug(
              sender,
              `${message}\n\n${JSON.stringify(
                {
                  ...reminder,
                  eventTime: new Date(reminder.eventTimestamp),
                },
                null,
                2
              )}`
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
    if (!this.notifierWebhookUrl) {
      return;
    }
    await fetch(this.notifierWebhookUrl, {
      method: HttpMethod.POST,
      headers: {
        [HttpHeader.CONTENT_TYPE]: ContentType.APPLICATION_JSON,
      },
      body: JSON.stringify({
        username:
          process.env.NODE_ENV === "development" ? `{DEV} ${sender}` : sender,
        // NOTE: Discord has a weird issue that I didn't have time to investigate where
        // webhook bots seem to not be able to raise more than 3 push notifications on IOS
        // e.g. after sending 3 notifications, the 4th will not be shown as push nofication
        // the workaround is to mention roles like @everyone or @here, or some custom role like this
        content: `${
          this.notifierWebhookMentionRoleID
            ? `<@&${this.notifierWebhookMentionRoleID}> `
            : ""
        }${message}`,
      }),
    });
  }

  private async notifyDebug(sender: string, message: string) {
    if (!this.notifierWebhookDebugUrl) {
      return;
    }
    await fetch(this.notifierWebhookDebugUrl, {
      method: HttpMethod.POST,
      headers: {
        [HttpHeader.CONTENT_TYPE]: ContentType.APPLICATION_JSON,
      },
      body: JSON.stringify({
        username:
          process.env.NODE_ENV === "development"
            ? `{DEBUG-DEV} ${sender}`
            : `{DEBUG} ${sender}`,
        content: message,
      }),
    });
  }

  private shouldNotifyEvent(event: BabyCareEvent) {
    if (event instanceof BottleFeedEvent || event instanceof NursingEvent) {
      return event.profile.settings.enableFeedingNotification;
    } else if (event instanceof PumpingEvent) {
      return event.profile.settings.enablePumpingNotification;
    }
    return event.profile.settings.enableOtherActivitiesNotification;
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

  private updateReminderForEvent(event: BabyCareEvent, update = false) {
    let reminder: BabyCareEventReminder;
    if (event instanceof BottleFeedEvent || event instanceof NursingEvent) {
      reminder = new FeedingEventReminder(event);
    } else if (event instanceof PumpingEvent) {
      reminder = new PumpingEventReminder(event);
    } else {
      return;
    }

    if (update) {
      const existingReminder = this._reminderEventMap.get(reminder.eventId);
      if (
        existingReminder &&
        existingReminder.eventTimestamp !== reminder.eventTimestamp
      ) {
        // if the event timestamp is updated, update the reminder timestamp
        // also, reset the ``lastNotifiedTimestamp` value
        existingReminder.eventTimestamp = reminder.eventTimestamp;
        existingReminder.lastNotifiedTimestamp = undefined;
      }
    }

    // find all reminder for the same event type
    const reminders = Array.from(this._reminderEventMap.values())
      .filter((_reminder) => _reminder.eventType === reminder.eventType)
      // sort descending by event timestamp
      .sort((a, b) => b.eventTimestamp - a.eventTimestamp);
    const latestReminder = getNullableEntry(reminders, 0);
    // cleanup all stale reminders except for the latest reminder
    reminders.forEach((_reminder, idx) => {
      if (idx !== 0) {
        this._reminderEventMap.delete(_reminder.eventId);
      }
    });

    // if there is no latest reminder, just simply add the new reminder
    if (!latestReminder) {
      this._reminderEventMap.set(reminder.eventId, reminder);
    } else if (reminder.eventTimestamp > latestReminder.eventTimestamp) {
      // if the new reminder is more recent than the latest reminder, update the latest reminder
      if (latestReminder.eventId === reminder.eventId) {
        reminder.lastNotifiedTimestamp = latestReminder.lastNotifiedTimestamp;
      } else {
        this._reminderEventMap.delete(latestReminder.eventId);
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
    this.updateReminderForEvent(event, true);
  }

  // when an event is removed, remove its associated reminder
  async eventRemoved(event: BabyCareEvent) {
    this._reminderEventMap.delete(event.id);
  }

  async requestAssistant(idOrHandle: string) {
    const profile = await BabyCareDataRegistry.fetchProfileByIdOrHandle(
      idOrHandle
    );
    BabyCareEventManager.notificationService.notify(
      `[Help] ${profile.nickname ?? profile.name}`,
      `Needs assistance!`
    );
    if (!this.requestAssistantUrl) {
      return;
    }
    await fetch(this.requestAssistantUrl, {
      method: HttpMethod.POST,
    });
  }

  async notifyMessage(
    message: string,
    options: {
      idOrHandle?: string | undefined;
      debug?: boolean | undefined;
    }
  ) {
    const profile = options.idOrHandle
      ? await BabyCareDataRegistry.fetchProfileByIdOrHandle(options.idOrHandle)
      : undefined;
    const sender = `[Notify] ${
      profile ? profile.nickname ?? profile.name : "System"
    }`;
    if (options.debug) {
      this.notifyDebug(sender, message);
    } else {
      this.notify(sender, message);
    }
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
