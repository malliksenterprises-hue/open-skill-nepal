const mediasoup = require('mediasoup');
const logger = require('../utils/logger');
const LiveSession = require('../models/LiveSession');

class MediasoupService {
    constructor() {
        this.workers = [];
        this.rooms = new Map();
        this.workerIndex = 0;
    }

    async initialize() {
        const numWorkers = process.env.MEDIASOUP_NUM_WORKERS || 1;
        
        for (let i = 0; i < numWorkers; i++) {
            const worker = await mediasoup.createWorker({
                logLevel: 'warn',
                logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
                rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000,
                rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT) || 40100
            });

            worker.on('died', () => {
                logger.error('Mediasoup worker died');
                process.exit(1);
            });

            this.workers.push(worker);
            logger.info(`Mediasoup worker ${i} created [pid:${worker.pid}]`);
        }
    }

    async createRoom(roomId, sessionId, options = {}) {
        const worker = this.getNextWorker();
        
        const router = await worker.createRouter({
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: {
                        'x-google-start-bitrate': 1000
                    }
                }
            ]
        });

        const room = {
            id: roomId,
            sessionId,
            router,
            worker,
            peers: new Map(),
            producers: new Map(),
            consumers: new Map(),
            transports: new Map(),
            recording: options.recording || false
        };

        this.rooms.set(roomId, room);
        logger.info(`Room ${roomId} created for session ${sessionId}`);
        
        return room;
    }

    async createWebRtcTransport(roomId, direction = 'send') {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error('Room not found');

        const transport = await room.router.createWebRtcTransport({
            listenIps: [{
                ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
                announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null
            }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
            initialAvailableOutgoingBitrate: 1000000
        });

        room.transports.set(transport.id, transport);
        
        return {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
        };
    }

    getNextWorker() {
        const worker = this.workers[this.workerIndex];
        this.workerIndex = (this.workerIndex + 1) % this.workers.length;
        return worker;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
}

module.exports = new MediasoupService();
