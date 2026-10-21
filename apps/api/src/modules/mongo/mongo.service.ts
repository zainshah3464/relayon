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

    // Only register models if not already registered (avoids OverwriteModelError)
    this.eventModel =
      (this.connection.models[EventDocument.name] as Model<EventDoc>) ??
      this.connection.model<EventDoc>(EventDocument.name, EventSchema);

    this.deliveryModel =
      (this.connection.models[DeliveryDocument.name] as Model<DeliveryDoc>) ??
      this.connection.model<DeliveryDoc>(DeliveryDocument.name, DeliverySchema);

    this.logger.log(`MongoDB connected (db=${dbName})`);
  }

  async onModuleDestroy(): Promise<void> {
    await mongoose.disconnect();
  }
}