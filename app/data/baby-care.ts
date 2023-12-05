import {
  MikroORM,
  type Options,
  type IDatabaseDriver,
  type Connection,
  Property,
  ManyToOne,
  DateType,
} from "@mikro-orm/core";
import { Entity, PrimaryKey } from "@mikro-orm/core";
import { v4 as uuid } from "uuid";

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

@Entity()
export class BabyCareProfile {
  @PrimaryKey({ type: "string" })
  readonly id = uuid();

  @Property({ type: "string", nullable: true })
  shortId?: string;

  @Property({ type: "string" })
  name: string;

  @Property({ type: "string", nullable: true })
  nickname?: string;

  @Property({ type: () => Gender })
  genderAtBirth: Gender;

  @Property({ type: DateType })
  dob: Date;

  @Property({ type: "number", nullable: true })
  defaultFeedingVolume?: number;

  constructor(name: string, genderAtBirth: Gender, dob: Date) {
    this.name = name;
    this.genderAtBirth = genderAtBirth;
    this.dob = dob;
  }
}

class BabyCareEvent {
  @PrimaryKey({ type: "string" })
  readonly id = uuid();

  @Property({ type: "Date" })
  time: Date;

  @Property({ type: "number", nullable: true })
  duration?: number;

  @ManyToOne(() => BabyCareProfile, { onDelete: "cascade" })
  profile: BabyCareProfile;

  @Property({ type: "string", nullable: true })
  comment?: string;

  constructor(time: Date, profile: BabyCareProfile) {
    this.time = time;
    this.profile = profile;
  }
}

@Entity()
export class BottleEvent extends BabyCareEvent {
  @Property({ type: "number" })
  volume: number;

  @Property({ type: "number" })
  breastMilkVolume: number;

  constructor(
    time: Date,
    profile: BabyCareProfile,
    volume: number,
    breastMilkVolume: number
  ) {
    super(time, profile);
    this.volume = volume;
    this.breastMilkVolume = breastMilkVolume;
  }
}

@Entity()
export class PeeEvent extends BabyCareEvent {}

@Entity()
export class PoopEvent extends BabyCareEvent {}

@Entity()
export class SleepEvent extends BabyCareEvent {}

@Entity()
export class PlayEvent extends BabyCareEvent {}

@Entity()
export class BathEvent extends BabyCareEvent {}

const BABY_CARE_DB_CONFIG: Options = {
  dbName: "./storage/baby-care.db",
  type: "sqlite",
  entities: [
    BabyCareProfile,
    BottleEvent,
    PoopEvent,
    PeeEvent,
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
      } catch {
        // do nothing
      }
      BabyCareDataRegistry._orm = orm;
    }
    return BabyCareDataRegistry._orm;
  }

  public static async getEntityManager() {
    return (await BabyCareDataRegistry.getORM()).em.fork();
  }
}
