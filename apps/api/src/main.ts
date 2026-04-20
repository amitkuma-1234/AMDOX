import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "api/v",
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle("AMDOX API")
    .setDescription("AMDOX Intelligent Document Platform API")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addTag("health", "Health check endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);

  console.log(`🚀 AMDOX API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
