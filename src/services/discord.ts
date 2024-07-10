import {
    TextChannel,
    VoiceChannel,
    Channel,
    Client,
    Message,
    Intents,
    PresenceStatusData,
} from 'discord.js';
import { DiscordMessageHandler } from '../interface/discord-message-handler';
import { IStatefulService } from '../types/service';
import { LogLevel } from '../util/logger';
import { Manager } from '../control/manager';
import { injectable, singleton } from 'tsyringe';
import { LoggerFactory } from './loggerfactory';
import { EventBus } from '../control/event-bus';
import { InternalEventTypes } from '../types/events';
import { DiscordMessage, isDiscordChannelType } from '../types/discord';
import { ServerState } from "../types/monitor";


@singleton()
@injectable()
export class DiscordBot extends IStatefulService {

    public client: Client | undefined;
    private ready = false;
    private serverOnline;

    private msgQueue: DiscordMessage[] = [];

    public debug: boolean = false;

    public constructor(
        loggerFactory: LoggerFactory,
        private manager: Manager,
        private messageHandler: DiscordMessageHandler,
        private eventBus: EventBus,
    ) {
        super(loggerFactory.createLogger('Discord'));

        this.eventBus.on(
            InternalEventTypes.DISCORD_MESSAGE,
            /* istanbul ignore next */ (message: DiscordMessage) => this.sendMessage(message),
        );

        /* istanbul ignore next */
        this.eventBus.on(
            InternalEventTypes.MONITOR_STATE_CHANGE,
             async (newState, prevState) => {
                switch (newState) {
                    case ServerState.STARTED:
                        this.updateStatus('Server Started - 0 Players Online');
                        this.serverOnline = true;
                        break;
                    case ServerState.STARTING:
                        this.updateStatus('Server Starting');
                        this.serverOnline = false;
                        break;
                    case ServerState.STOPPED:
                        this.updateStatus('Server Offline');
                        this.serverOnline = false;
                        break;
                    case ServerState.STOPPING:
                        this.updateStatus('Server Stopping');
                        this.serverOnline = false;
                        break;
                    default:
                        this.updateStatus('Unable to find server status.');
                        this.serverOnline = false;
                        this.log.log(LogLevel.WARN, `${newState}, ${prevState}`);
                        break;
                }
            },
        )
        
        /* istanbul ignore next */
        this.eventBus.on(
            InternalEventTypes.DISCORD_STATUS_REQUEST,
            (msg: string) => this.updateStatus(msg),
        )
    }

    public async start(): Promise<void> {

        if (!this.manager.config.discordBotToken) {
            this.log.log(LogLevel.WARN, 'Not starting discord bot, because no bot token was provided');
            return;
        }

        try {
            const client = new Client({ intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                Intents.FLAGS.MESSAGE_CONTENT,
            ] });
            client.on('ready', (c) => {
                this.onReady();
            });
            if (this.debug) {
                client.on('invalidated', () => this.log.log(LogLevel.ERROR, 'invalidated'));
                client.on('debug', (m) => this.log.log(LogLevel.DEBUG, m));
                client.on('warn', (m) => this.log.log(LogLevel.WARN, m));
            }
            client.on('messageCreate', (m) => this.onMessage(m));
            client.on('disconnect', (d) => {
                if (d?.wasClean) {
                    this.log.log(LogLevel.INFO, 'disconnect');
                } else {
                    this.log.log(LogLevel.ERROR, 'disconnect', d);
                }
            });
            client.on('error', (e) => this.log.log(LogLevel.ERROR, 'error', e));
            await client.login(this.manager.config.discordBotToken);
            this.client = client;
            this.sendQueuedMessage();
        } catch (e) {
            this.log.log(LogLevel.WARN, 'Not starting discord bot, login failed', e);
        }
    }
    
    /* istanbul ignore next*/
    private onReady(): void {
        this.log.log(LogLevel.IMPORTANT, 'Discord Ready!');
        this.log.log(
            LogLevel.DEBUG,
            'Guildes',
            this.client?.guilds?.cache?.map(
                /* istanbul ignore next */ (guild) => [guild.id, guild.name],
            ),
        );
        this.ready = true;
        this.sendQueuedMessage();
        this.updateStatus('Server Starting');
        this.serverOnline = false;

        setInterval(() => {
            this.setTime();
        }, 1 * 60 * 1000);
    }

    /* istanbul ignore next*/
    private sendQueuedMessage(): void {
        setTimeout(() => {
            const msgQueue = this.msgQueue;
            this.msgQueue = [];
            for (const msg of msgQueue) {
                void this.sendMessage(msg);
            }
        }, 1000);
    }

    private onMessage(message: Message): void {
        if (message.author.bot) {
            return;
        }

        if (this.debug) {
            this.log.log(LogLevel.DEBUG, `Detected message: ${message.content}`);
        }

        if (message.content?.startsWith(this.messageHandler.PREFIX)) {
            void this.messageHandler.handleCommandMessage(message);
        }
    }

    public async stop(): Promise<void> {
        this.ready = false;
        if (this.client) {
            await this.client.destroy();
            this.client = undefined;
        }
    }

    public async sendMessage(message: DiscordMessage): Promise<void> {

        if (!this.client || !this.ready) {
            this.log.log(LogLevel.WARN, `Queueing message because client did not start or is not yet ready`, this.ready);
            this.msgQueue.push(message);
            return;
        }

        const channels = this.manager.config.discordChannels
            ?.filter((x) => isDiscordChannelType(x.mode, message.type));
        const matching = this.client.guilds?.cache?.first()?.channels?.cache
            ?.filter((channel) => {
                return channels?.some((x) => x.channel === channel.name?.toLowerCase()) ?? false;
            }).map((x) => x) || [];

        if (!matching?.length) {
            this.log.log(
                LogLevel.DEBUG,
                'No channel found for: ' + channels.map(
                     /* istanbul ignore next */ (x) => x.channel,
                ).join(', '),
            );
        }
        for (const x of matching) {
            try {
                if (message.message) {
                    await (x as TextChannel).send(message.message);
                }
                if (message.embeds?.length) {
                    for (const embed of message.embeds) {
                        await (x as TextChannel).send({ embeds: [embed] });
                    }
                }
            } catch (e) {
                this.log.log(LogLevel.ERROR, `Error relaying message to channel: ${x.name}`, e);
            }
        }
    }

    /* istanbul ignore next*/
    public async updateStatus(msg: string): Promise<void> {
        if (this.client && this.ready && msg !== undefined) {
            this.client.user?.setActivity(`${msg}`, { type: 'CUSTOM' });
        }
    }

    /* istanbul ignore next*/
    public minutesUntilNextFourthHour(): number {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();
    
        const hoursUntilNextFourth = (4 - (currentHour % 4)) % 4;
        const totalMinutesUntilNextFourth = (hoursUntilNextFourth * 60) - currentMinutes;
    
        return hoursUntilNextFourth === 0 ? (4 * 60) - currentMinutes : totalMinutesUntilNextFourth;
    }

    /* istanbul ignore next*/
    public async setTime() {
        if (this.client && this.ready && this.serverOnline) {
            const RTchannel = await this.client.channels.fetch('1260458188097196032');
            const IGTChannel = await this.client.channels.fetch('1260458131943723079');
            var neatTime = this.convertTime(this.minutesUntilNextFourthHour());
            if (RTchannel) {
                if (RTchannel.isVoice()) {
                    RTchannel.setName(`Restart in ${neatTime}`);
                }
            }
            if (IGTChannel) {
                if (IGTChannel.isVoice()) {
                    
                }
            }
        }
    }

    /* istanbul ignore next*/
    public convertTime(timeInMinutes: number): string {
        const hours = Math.floor(timeInMinutes / 60);
        const minutes = timeInMinutes % 60;
        return `${hours}h ${minutes}m`;
    }

}
