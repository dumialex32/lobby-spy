// app.module.ts
import { Module } from '@nestjs/common';
import { ReplayModule } from './replay/replay.module';
import { AuthModule } from './auth/auth.module'; // 👈 import it here

@Module({
  imports: [ReplayModule, AuthModule],
})
export class AppModule {}
