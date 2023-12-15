import {
  MikroORM,
  type Options,
  type IDatabaseDriver,
  type Connection,
  Property,
  ManyToOne,
  DateType,
  DateTimeType,
  TableExistsException,
} from "@mikro-orm/core";
import { Entity, PrimaryKey } from "@mikro-orm/core";
import { v4 as uuid } from "uuid";

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

export const DEFAULT_PUMPING_TIME = 30 * 60 * 1000; // 30 minutes

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

export abstract class BabyCareEvent {
  @PrimaryKey({ type: "string" })
  readonly id = uuid();

  @Property({ type: DateTimeType })
  time: Date;

  @Property({ type: "number", nullable: true })
  duration?: number | undefined;

  @ManyToOne(() => BabyCareProfile, { onDelete: "cascade" })
  profile: BabyCareProfile;

  @Property({ type: "string", nullable: true })
  comment?: string | undefined;

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
}
