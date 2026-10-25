import { Module } from '@nestjs/common';
import { ContextoInternoController } from './contexto-interno.controller.js';
import { PerfilesController } from './perfiles.controller.js';
import { PerfilesService } from './perfiles.service.js';
import { TemasInternoController } from './temas-interno.controller.js';
import { TemasService } from './temas.service.js';

@Module({
  controllers: [PerfilesController, TemasInternoController, ContextoInternoController],
  providers: [PerfilesService, TemasService],
})
export class PerfilesModule {}
