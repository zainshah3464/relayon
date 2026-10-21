import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose, { Connection, Model } from 'mongoose';
import { EventDocument, EventSchema, EventDoc } from './schemas/event.schema';
import {
  DeliveryDocument,
  DeliverySchema,
  DeliveryDoc,
} from './schemas/delivery.schema';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);
  private connection!: Connection;

  eventModel!: Model<EventDoc>;
  deliveryModel!: Model<DeliveryDoc>;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const uri = this.config.getOrThrow<string>('MONGODB_URI');
    const dbName = this.config.get<string>('MONGODB_DB_NAME') ?? 'relayon';

    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
    this.connection = mongoose.connection;

    this.eventModel = this.connection.model<EventDoc>(
      EventDocument.name,
      EventSchema,
    );
    this.deliveryModel = this.connection.model<DeliveryDoc>(
      DeliveryDocument.name,
      DeliverySchema,
    );

    // Ensure indexes exist (idempotent)
    await Promise.all([
      this.eventModel.syncIndexes(),
      this.deliveryModel.syncIndexes(),
    ]);

    this.logger.log(`MongoDB connected (db=${dbName})`);
  }

  async onModuleDestroy(): Promise<void> {
    await mongoose.disconnect();
  }
}