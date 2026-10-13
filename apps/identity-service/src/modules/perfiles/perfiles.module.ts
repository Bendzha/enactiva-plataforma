import { Module } from '@nestjs/common';
import { PerfilesController } from './perfiles.controller.js';
import { PerfilesService } from './perfiles.service.js';
import { TemasService } from './temas.service.js';

@Module({
  controllers: [PerfilesController],
  providers: [PerfilesService, TemasService],
})
export class PerfilesModule {}
