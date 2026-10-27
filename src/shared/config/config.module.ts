import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          const formatted = result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n');
          throw new Error(`❌ Environment validation failed:\n${formatted}`);
        }
        return result.data;
      },
      isGlobal: true,
    }),
  ],
})
export class AppConfigModule {}
