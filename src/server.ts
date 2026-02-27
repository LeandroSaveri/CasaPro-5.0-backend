import app from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";

async function bootstrap() {
  try {
    await connectDatabase();
    console.log("✅ Database connected");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    // NÃO MATAR O SERVIDOR
  }

  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`🚀 CasaPro SaaS Backend running on port ${env.PORT}`);
  });
}

bootstrap();
