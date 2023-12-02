import {
  MikroORM,
  type Options,
  type IDatabaseDriver,
  Connection,
  Property,
  ManyToOne,
} from "@mikro-orm/core";
import { Entity, PrimaryKey } from "@mikro-orm/core";
import { v4 as uuid } from "uuid";

@Entity()
export class BabyCareProfile {
  @PrimaryKey({ type: "string" })
  id = uuid();

  @Property({ type: "string" })
  name: string;

  @Property({ type: "string", nullable: true })
  nickname?: string;

  @Property({ type: "Date" })
  birthTime: Date;

  @Property({ type: "number", nullable: true })
  defaultBreastMilkVolume?: number;

  @Property({ type: "number", nullable: true })
  defaultFormulaMilkVolume?: number;

  constructor(name: string, birthTime: Date) {
    this.name = name;
    this.birthTime = birthTime;
  }
}

class BabyCareEvent {
  @PrimaryKey({ type: "string" })
  id = uuid();

  @Property({ type: "Date" })
  time: Date;

  @ManyToOne(() => BabyCareProfile, { onDelete: "cascade" })
  profile: BabyCareProfile;

  constructor(time: Date, profile: BabyCareProfile) {
    this.time = time;
    this.profile = profile;
  }
}

@Entity()
export class BottleEvent extends BabyCareEvent {
  @Property({ type: "number" })
  breastMilkVolume: number;

  @Property({ type: "number" })
  formulaMilkVolume: number;

  constructor(
    time: Date,
    profile: BabyCareProfile,
    breastMilkVolume: number,
    formulaMilkVolume: number
  ) {
    super(time, profile);
    this.breastMilkVolume = breastMilkVolume;
    this.formulaMilkVolume = formulaMilkVolume;
  }
}

@Entity()
export class DiaperChangeEvent extends BabyCareEvent {
  @Property({ type: "boolean", nullable: true })
  dirty?: boolean;
}

const BABY_CARE_DB_CONFIG: Options = {
  dbName: "./storage/baby-care.db",
  type: "sqlite",
  entities: [BabyCareProfile, DiaperChangeEvent, BottleEvent],
  discovery: { disableDynamicFileAccess: true },
};

export class BabyCareDataRegistry {
  private static _instance: BabyCareDataRegistry;
  private static _orm: MikroORM<IDatabaseDriver<Connection>>;

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
