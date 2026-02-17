require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

let config = JSON.parse(fs.readFileSync("./config.json"));

function saveConfig() {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
}

/* ===================== RUOLI E STIPENDI ===================== */

const stipendi = [
  { role: "In prova", paga: 300 },
  { role: "Dipendente", paga: 600 },
  { role: "Posto Fisso", paga: 900 },
  { role: "Dirigenza", paga: 1200 },
  { role: "Vice Direttore", paga: 1500 },
  { role: "Direttore", paga: 1800 },
  { role: "Co-Proprietario", paga: 2100 },
  { role: "Proprietario", paga: 2400 }
];

const cartellino = {};
const fatture = [];

/* ===================== READY ===================== */

client.once("ready", async () => {
  console.log(`✅ Online come ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName("setup").setDescription("Setup bot").setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("fattura")
      .setDescription("Registra fattura")
      .addStringOption(o => o.setName("cliente").setDescription("Cliente"))
      .addStringOption(o => o.setName("oggetto").setDescription("Oggetto").setRequired(true))
      .addIntegerOption(o => o.setName("prezzo").setDescription("Prezzo").setRequired(true))
      .addAttachmentOption(o => o.setName("foto").setDescription("Foto sopra 500k")),

    new SlashCommandBuilder().setName("annullafattura").setDescription("Annulla ultima fattura"),

    new SlashCommandBuilder()
      .setName("percentuale")
      .setDescription("Modifica percentuale fatture")
      .addIntegerOption(o =>
        o.setName("valore")
          .setDescription("Nuova percentuale")
          .setRequired(true),
      )
   new SlashCommandBuilder()
     .setName("admin")
     .setDescription("Pannello amministratore"),

  ];

  await client.application.commands.set(commands);
});

/* ===================== PERCENTUALE ===================== */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "percentuale") return;

  const member = interaction.member;
  if (!member.roles.cache.has(config.adminRole))
    return interaction.reply({ content: "❌ Non hai i permessi", ephemeral: true });

  const valore = interaction.options.getInteger("valore");
  if (valore < 0 || valore > 100)
    return interaction.reply({ content: "❌ Percentuale non valida", ephemeral: true });

  config.percentualeFatture = valore;
  saveConfig();

  interaction.reply({ content: `✅ Percentuale aggiornata al ${valore}%`, ephemeral: true });
});
/* ===================== PANNELLO ADMIN ===================== */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "admin") return;

  if (!interaction.member.roles.cache.has(config.adminRole)) {
    return interaction.reply({ content: "❌ Non hai i permessi", ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle("🛠️ Pannello Admin")
    .setDescription("Gestione rapida del bot")
    .setColor("DarkRed")
    .addFields(
      { name: "📊 Percentuale fatture", value: `${config.percentualeFatture}%`, inline: true },
      { name: "👥 Dipendenti attivi", value: `${Object.keys(cartellino).length}`, inline: true }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("admin_reset")
      .setLabel("Reset stipendi")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("admin_percentuale")
      .setLabel("Mostra percentuale")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("admin_close")
      .setLabel("Chiudi")
      .setStyle(ButtonStyle.Secondary),
  );

  interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
});

/* ===================== RESET STIPENDI SETTIMANALE ===================== */

setInterval(async () => {
  const now = Date.now();
  const settimana = 7 * 24 * 60 * 60 * 1000;

  if (!config.resetStipendiUltimo) {
    config.resetStipendiUltimo = now;
    saveConfig();
    return;
  }

  if (now - config.resetStipendiUltimo >= settimana) {
    for (const user of Object.values(cartellino)) {
      user.tempo = 0;
      user.guadagno = 0;
      user.inServizio = false;
    }

    config.resetStipendiUltimo = now;
    saveConfig();

    if (config.canaleAnnunci) {
      const ch = await client.channels.fetch(config.canaleAnnunci);
      ch.send("🔄 **Reset stipendi settimanale completato**");
    }
  }
}, 60 * 60 * 1000);

/* ===================== STIPENDI AUTOMATICI ===================== */

setInterval(() => {
  for (const [id, data] of Object.entries(cartellino)) {
    if (!data.inServizio) continue;

    data.tempo += 30;

    const guild = client.guilds.cache.first();
    const member = guild.members.cache.get(id);
    if (!member) continue;

    const ruolo = stipendi.slice().reverse().find(r =>
      member.roles.cache.some(x => x.name === r.role)
    );

    if (ruolo) data.guadagno += ruolo.paga;
  }
}, 30 * 60 * 1000);
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (!interaction.member.roles.cache.has(config.adminRole)) return;

  /* RESET STIPENDI */
  if (interaction.customId === "admin_reset") {
    for (const user of Object.values(cartellino)) {
      user.tempo = 0;
      user.guadagno = 0;
      user.inServizio = false;
    }

    config.resetStipendiUltimo = Date.now();
    saveConfig();

    return interaction.reply({
      content: "🔄 Stipendi e cartellini resettati manualmente",
      ephemeral: true
    });
  }

  /* MOSTRA PERCENTUALE */
  if (interaction.customId === "admin_percentuale") {
    return interaction.reply({
      content: `📊 Percentuale fatture attuale: **${config.percentualeFatture}%**`,
      ephemeral: true
    });
  }

  /* CHIUDI */
  if (interaction.customId === "admin_close") {
    return interaction.message.delete().catch(() => {});
  }
});

/* ===================== LOGIN ===================== */

client.login(process.env.DISCORD_TOKEN);
