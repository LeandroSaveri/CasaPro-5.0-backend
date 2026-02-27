import app from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";

async function bootstrap() {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`🚀 CasaPro SaaS Backend running on port ${env.PORT}`);
  });
}

bootstrap();
