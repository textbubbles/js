#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import { TextBubblesClient } from "./client.js";
import type {
  Message,
  Contact,
  PaymentRequest,
  WebhookConfig,
  CapabilityResult,
  MessageEffect,
  WebhookEventType,
} from "./types.js";

// ── Config ──

const CONFIG_DIR = path.join(os.homedir(), ".textbubbles");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

interface CLIConfig {
  apiKey: string;
  baseUrl?: string;
}

function loadConfig(): CLIConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as CLIConfig;
  } catch {
    return null;
  }
}

function saveConfig(config: CLIConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

function deleteConfig(): void {
  try {
    fs.unlinkSync(CONFIG_FILE);
  } catch {
    // Already gone
  }
}

function getClient(): TextBubblesClient {
  const envKey = process.env["TEXTBUBBLES_API_KEY"];
  const config = loadConfig();
  const apiKey = envKey ?? config?.apiKey;
  if (!apiKey) {
    console.error(
      chalk.red("Not authenticated. Run `textbubbles login` or set TEXTBUBBLES_API_KEY."),
    );
    process.exit(1);
  }
  return new TextBubblesClient({
    apiKey,
    baseUrl: config?.baseUrl,
  });
}

// ── Output Helpers ──

function jsonFlag(cmd: Command): boolean {
  const opts = cmd.optsWithGlobals?.() ?? cmd.opts();
  return opts.json === true;
}

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const sep = widths.map((w) => "─".repeat(w + 2)).join("┼");
  const fmt = (row: string[]) =>
    row.map((c, i) => ` ${(c ?? "").padEnd(widths[i]!)} `).join("│");

  console.log(chalk.bold(fmt(headers)));
  console.log(sep);
  rows.forEach((r) => console.log(fmt(r)));
}

function formatMessage(m: Message): string[] {
  return [
    m.id,
    m.to,
    m.status,
    m.content.text?.slice(0, 40) ?? "(media)",
    m.createdAt,
  ];
}

function formatContact(c: Contact): string[] {
  return [
    c.id,
    [c.firstName, c.lastName].filter(Boolean).join(" "),
    c.phoneNumber,
    c.tags.join(", "),
  ];
}

function formatPayment(p: PaymentRequest): string[] {
  return [p.id, p.to, `${p.amount} ${p.currency}`, p.status, p.note ?? ""];
}

async function run<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err: unknown) {
    spinner.fail();
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    process.exit(1);
  }
}

function promptSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // Disable echo for API key input
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      let input = "";
      const onData = (ch: Buffer) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r") {
          stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (c === "\u0003") {
          // Ctrl+C
          process.exit(1);
        } else if (c === "\u007F" || c === "\b") {
          input = input.slice(0, -1);
        } else {
          input += c;
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

// ── CLI Program ──

const program = new Command();

program
  .name("textbubbles")
  .description("TextBubbles CLI — send iMessages from the command line")
  .version("0.1.0")
  .option("--json", "Output raw JSON");

// ── Auth ──

program
  .command("login")
  .description("Save API key to ~/.textbubbles/config.json")
  .action(async () => {
    const apiKey = await promptSecret("API Key: ");
    if (!apiKey.trim()) {
      console.error(chalk.red("API key cannot be empty."));
      process.exit(1);
    }
    saveConfig({ apiKey: apiKey.trim() });
    console.log(chalk.green("Credentials saved to ~/.textbubbles/config.json"));
  });

program
  .command("logout")
  .description("Remove saved credentials")
  .action(() => {
    deleteConfig();
    console.log(chalk.green("Credentials removed."));
  });

program
  .command("whoami")
  .description("Show current auth status")
  .action(async () => {
    const config = loadConfig();
    const envKey = process.env["TEXTBUBBLES_API_KEY"];
    if (envKey) {
      console.log(chalk.green("Authenticated via TEXTBUBBLES_API_KEY env var"));
      console.log(`Key: ${envKey.slice(0, 6)}..${envKey.slice(-4)}`);
    } else if (config?.apiKey) {
      console.log(chalk.green("Authenticated via ~/.textbubbles/config.json"));
      console.log(`Key: ${config.apiKey.slice(0, 6)}..${config.apiKey.slice(-4)}`);
      if (config.baseUrl) {
        console.log(`Base URL: ${config.baseUrl}`);
      }
    } else {
      console.log(chalk.yellow("Not authenticated."));
    }
  });

// ── Messages ──

program
  .command("send <to> <message>")
  .description("Send a message")
  .option("--effect <effect>", "Message effect (e.g. confetti, fireworks)")
  .option("--media <url>", "Attach media URL")
  .action(async (to: string, message: string, opts: { effect?: string; media?: string }) => {
    const client = getClient();
    const msg = await run("Sending message", () =>
      client.messages.send({
        to,
        content: {
          text: message,
          media: opts.media ? [opts.media] : undefined,
        },
        effect: opts.effect as MessageEffect | undefined,
      }),
    );
    if (jsonFlag(program)) return printJson(msg);
    console.log(chalk.green(`Message sent: ${msg.id}`));
    console.log(`Status: ${msg.status}`);
  });

program
  .command("send:carousel <to> <urls...>")
  .description("Send an image carousel (2-20 images)")
  .action(async (to: string, urls: string[]) => {
    const client = getClient();
    const msg = await run("Sending carousel", () =>
      client.messages.sendCarousel({ to, mediaUrls: urls }),
    );
    if (jsonFlag(program)) return printJson(msg);
    console.log(chalk.green(`Carousel sent: ${msg.id}`));
  });

program
  .command("send:schedule <to> <message>")
  .description("Schedule a message")
  .requiredOption("--at <datetime>", "ISO 8601 datetime (e.g. 2026-03-29T09:00:00Z)")
  .action(async (to: string, message: string, opts: { at: string }) => {
    const client = getClient();
    const msg = await run("Scheduling message", () =>
      client.messages.send({
        to,
        content: { text: message },
        scheduledAt: opts.at,
      }),
    );
    if (jsonFlag(program)) return printJson(msg);
    console.log(chalk.green(`Message scheduled: ${msg.id}`));
    console.log(`Scheduled for: ${msg.scheduledAt}`);
  });

const messages = program.command("messages").description("Manage messages");

messages
  .command("list")
  .description("List messages")
  .option("--to <phone>", "Filter by recipient")
  .option("--limit <n>", "Max results", "20")
  .action(async (opts: { to?: string; limit: string }) => {
    const client = getClient();
    const result = await run("Fetching messages", () =>
      client.messages.list({ to: opts.to, limit: parseInt(opts.limit, 10) }),
    );
    if (jsonFlag(program)) return printJson(result);
    if (result.data.length === 0) {
      console.log(chalk.yellow("No messages found."));
      return;
    }
    printTable(
      ["ID", "To", "Status", "Text", "Created"],
      result.data.map(formatMessage),
    );
    console.log(chalk.dim(`\nShowing ${result.data.length} of ${result.total}`));
  });

messages
  .command("get <id>")
  .description("Get a message by ID")
  .action(async (id: string) => {
    const client = getClient();
    const msg = await run("Fetching message", () => client.messages.get(id));
    if (jsonFlag(program)) return printJson(msg);
    console.log(`${chalk.bold("ID:")}          ${msg.id}`);
    console.log(`${chalk.bold("To:")}          ${msg.to}`);
    console.log(`${chalk.bold("From:")}        ${msg.from}`);
    console.log(`${chalk.bold("Status:")}      ${msg.status}`);
    console.log(`${chalk.bold("Text:")}        ${msg.content.text ?? "(none)"}`);
    if (msg.content.media?.length) {
      console.log(`${chalk.bold("Media:")}       ${msg.content.media.join(", ")}`);
    }
    if (msg.effect) console.log(`${chalk.bold("Effect:")}      ${msg.effect}`);
    if (msg.scheduledAt) console.log(`${chalk.bold("Scheduled:")}  ${msg.scheduledAt}`);
    console.log(`${chalk.bold("Created:")}    ${msg.createdAt}`);
  });

messages
  .command("cancel <id>")
  .description("Cancel a scheduled message")
  .action(async (id: string) => {
    const client = getClient();
    await run("Cancelling message", () => client.messages.cancelSchedule(id));
    if (jsonFlag(program)) return printJson({ success: true, id });
    console.log(chalk.green(`Scheduled message ${id} cancelled.`));
  });

// ── Contacts ──

const contacts = program.command("contacts").description("Manage contacts");

contacts
  .command("list")
  .description("List contacts")
  .option("--tag <tag>", "Filter by tag")
  .option("--search <query>", "Search contacts")
  .option("--limit <n>", "Max results", "20")
  .action(async (opts: { tag?: string; search?: string; limit: string }) => {
    const client = getClient();
    const result = await run("Fetching contacts", () =>
      client.contacts.list({
        tag: opts.tag,
        search: opts.search,
        limit: parseInt(opts.limit, 10),
      }),
    );
    if (jsonFlag(program)) return printJson(result);
    if (result.data.length === 0) {
      console.log(chalk.yellow("No contacts found."));
      return;
    }
    printTable(
      ["ID", "Name", "Phone", "Tags"],
      result.data.map(formatContact),
    );
    console.log(chalk.dim(`\nShowing ${result.data.length} of ${result.total}`));
  });

contacts
  .command("create")
  .description("Create a contact")
  .requiredOption("--phone <number>", "Phone number")
  .requiredOption("--name <name>", "Full name (first last)")
  .option("--email <email>", "Email address")
  .option("--tags <tags>", "Comma-separated tags")
  .action(async (opts: { phone: string; name: string; email?: string; tags?: string }) => {
    const client = getClient();
    const parts = opts.name.split(" ");
    const firstName = parts[0]!;
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
    const contact = await run("Creating contact", () =>
      client.contacts.create({
        firstName,
        lastName,
        phoneNumber: opts.phone,
        email: opts.email,
        tags: opts.tags?.split(",").map((t) => t.trim()),
      }),
    );
    if (jsonFlag(program)) return printJson(contact);
    console.log(chalk.green(`Contact created: ${contact.id}`));
  });

contacts
  .command("get <id>")
  .description("Get a contact by ID")
  .action(async (id: string) => {
    const client = getClient();
    const c = await run("Fetching contact", () => client.contacts.get(id));
    if (jsonFlag(program)) return printJson(c);
    console.log(`${chalk.bold("ID:")}     ${c.id}`);
    console.log(`${chalk.bold("Name:")}   ${[c.firstName, c.lastName].filter(Boolean).join(" ")}`);
    console.log(`${chalk.bold("Phone:")}  ${c.phoneNumber}`);
    if (c.email) console.log(`${chalk.bold("Email:")}  ${c.email}`);
    if (c.tags.length) console.log(`${chalk.bold("Tags:")}   ${c.tags.join(", ")}`);
  });

contacts
  .command("delete <id>")
  .description("Delete a contact")
  .action(async (id: string) => {
    const client = getClient();
    await run("Deleting contact", () => client.contacts.delete(id));
    if (jsonFlag(program)) return printJson({ success: true, id });
    console.log(chalk.green(`Contact ${id} deleted.`));
  });

// ── Capabilities ──

program
  .command("check <phone>")
  .description("Check if a phone number supports iMessage")
  .action(async (phone: string) => {
    const client = getClient();
    const result = await run("Checking capabilities", () =>
      client.capabilities.check(phone),
    );
    if (jsonFlag(program)) return printJson(result);
    const icon = result.iMessage ? chalk.green("✓") : chalk.red("✗");
    console.log(`${icon} ${result.phoneNumber}: iMessage ${result.iMessage ? "supported" : "not supported"}`);
  });

// ── Webhooks ──

const webhooks = program.command("webhooks").description("Manage webhooks");

webhooks
  .command("get")
  .description("Get current webhook configuration")
  .action(async () => {
    const client = getClient();
    const config = await run("Fetching webhook config", () =>
      client.webhooks.get(),
    );
    if (jsonFlag(program)) return printJson(config);
    console.log(`${chalk.bold("URL:")}    ${config.url}`);
    console.log(`${chalk.bold("Events:")} ${config.events.join(", ")}`);
  });

webhooks
  .command("set <url>")
  .description("Set webhook URL")
  .option("--events <events>", "Comma-separated event types")
  .option("--secret <secret>", "Webhook secret")
  .action(async (url: string, opts: { events?: string; secret?: string }) => {
    const client = getClient();
    const events = opts.events
      ? (opts.events.split(",").map((e) => e.trim()) as WebhookEventType[])
      : undefined;
    // Fetch current config for defaults
    let current: WebhookConfig | undefined;
    if (!events || !opts.secret) {
      try {
        current = await client.webhooks.get();
      } catch {
        // No existing config
      }
    }
    const config = await run("Setting webhook", () =>
      client.webhooks.set({
        url,
        events: events ?? current?.events ?? [],
        secret: opts.secret ?? current?.secret ?? "",
      }),
    );
    if (jsonFlag(program)) return printJson(config);
    console.log(chalk.green("Webhook updated."));
    console.log(`${chalk.bold("URL:")}    ${config.url}`);
    console.log(`${chalk.bold("Events:")} ${config.events.join(", ")}`);
  });

// ── Payments ──

program
  .command("pay:request <to> <amount>")
  .description("Request a payment")
  .option("--memo <memo>", "Payment memo")
  .option("--currency <currency>", "Currency code", "USD")
  .action(async (to: string, amount: string, opts: { memo?: string; currency: string }) => {
    const client = getClient();
    const payment = await run("Requesting payment", () =>
      client.payments.request({
        to,
        amount: parseFloat(amount),
        currency: opts.currency,
        note: opts.memo,
      }),
    );
    if (jsonFlag(program)) return printJson(payment);
    console.log(chalk.green(`Payment requested: ${payment.id}`));
    console.log(`Amount: ${payment.amount} ${payment.currency}`);
    if (payment.note) console.log(`Note: ${payment.note}`);
  });

program
  .command("pay:list")
  .description("List payment requests")
  .action(async () => {
    const client = getClient();
    const result = await run("Fetching payments", () => client.payments.list());
    if (jsonFlag(program)) return printJson(result);
    if (result.data.length === 0) {
      console.log(chalk.yellow("No payment requests found."));
      return;
    }
    printTable(
      ["ID", "To", "Amount", "Status", "Memo"],
      result.data.map(formatPayment),
    );
  });

program
  .command("pay:cancel <id>")
  .description("Cancel a payment request")
  .action(async (id: string) => {
    const client = getClient();
    await run("Cancelling payment", () => client.payments.cancel(id));
    if (jsonFlag(program)) return printJson({ success: true, id });
    console.log(chalk.green(`Payment ${id} cancelled.`));
  });

// ── Run ──

program.parseAsync().catch((err: unknown) => {
  console.error(chalk.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
