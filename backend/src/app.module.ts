import { Module } from '@nestjs/common';
import { ReplayModule } from './replay/replay.module';

@Module({
  imports: [ReplayModule],
})
export class AppModule {}
