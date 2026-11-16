import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_KEY = 'relayon:feature_flag';

export const FeatureFlag = (key: string) => SetMetadata(FEATURE_FLAG_KEY, key);