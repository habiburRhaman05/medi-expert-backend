import express, { type Express } from "express";
import { envConfig } from "./config/env"; 
import { applyMiddleware } from "./middleware";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import indexRouter from "./routes/index.route";
import { emailQueue } from "./queue/emailQueue";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";
import path from "path";
import { cwd } from "process";
const app: Express = express();
import bodyParser from "body-parser"
import Stripe from "stripe"
import stripeRouter from "./modules/stripe/stripe.route";



app.set("trust proxy", 1);
app.use("/api/v1/stripe",stripeRouter)
applyMiddleware(app);
app.use("/api/auth",toNodeHandler(auth))
app.use("/api/v1",indexRouter)
// 1. Set EJS as the view engine
app.set('view engine', 'ejs');

// 2. Set the directory for your views (optional, defaults to './views')
app.set('views',path.join(`${cwd()}/src/templates`));
app.get("/health",async (_req, res) =>{
  try {
                        await emailQueue.add("sendEmail", {user:"user"}, {
    priority: 1,
    attempts: 3, // retry 3 times if fails
    backoff: { type: "exponential", delay: 1000 },
  });
  console.log(emailQueue.getJobs());
  
} catch (error) {
    console.log("error");
    
}
  res.status(200).json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
});


// app.get("/", (req, res) => {
//   res.render("home");
// });

// server.ts
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.get('/', async (req, res) => {
  await delay(3000); 
  res.json({
    message:   'Hello!',
    server_id: process.env.SERVER_ID,  
    container: process.env.HOSTNAME,   
    port:      process.env.PORT,
    pid:       process.pid
  });
});

export const startServer = async () => {

  try {
    const PORT = envConfig.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    })

  } catch (error) {
    console.error('❌ Error initializing app:', error);
    process.exit(1);
  }
};
app.use(notFound);
app.use(errorHandler);



export default app;



