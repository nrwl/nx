import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getData(): string {
    return this.appService.getData();
  }
}
