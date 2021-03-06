import {Request} from 'hapi';
import * as fs from 'fs';
import * as path from 'path';

const firmwareFilePath = path.resolve(__dirname, '../../../provisioning-server/static/firmware');
const bootromFilePath = path.resolve(__dirname, '../../../provisioning-server/static/bootrom');

const routes = [
    {
        method: 'GET',
        path: '/firmware/files',
        handler: async (request: Request, h: any) => {
            const logger = request.server.app.logger;

            logger.debug(`Running /firmware/files.`);

            try {
                let files = fs.readdirSync(firmwareFilePath).concat(fs.readdirSync(bootromFilePath));
                files = files.filter(f => f !== '.placeholder');
                logger.debug(`Fetching all firmware files.`);
                return files;
            } catch(e) {
                logger.error(e);
                return h.response().code(500);
            }
        },
        config: {
            auth: false
        }
    },
    {
        method: 'POST',
        path: '/firmware/remove-file',
        handler: async (request: Request, h: any) => {
            const logger = request.server.app.logger;

            logger.debug(`Running /firmware/remove-file. Raw payload:\n${JSON.stringify(request.payload)}`);

            try {
                const filename = path.basename(request.payload.filename);
                const firmwareFile = path.resolve(firmwareFilePath, filename);
                const bootromFile = path.resolve(bootromFilePath, filename);

                if(fs.existsSync(firmwareFile)) {
                    fs.unlinkSync(firmwareFile);
                } else if(fs.existsSync(bootromFile)) {
                    fs.unlinkSync(bootromFile);
                } else {
                    return h.response().code(500);
                }

                return h.response().code(200);
            } catch(e) {
                logger.error(e);
                return h.response().code(500);
            }
        },
        config: {
            auth: false
        }
    },
    {
        method: 'POST',
        path: '/firmware/add-files',
        handler: async (request: Request, h: any) => {
            const logger = request.server.app.logger;

            //Don't log the raw contents of the files
            const readablePayload = Array.isArray(request.payload.files) ?
                request.payload.files.map((f:any) => Object.assign({}, f, {_data: ['...']})) :
                Object.assign({}, request.payload.files, {_data: ['...']});
            logger.debug(`Running /firmware/add-files. Raw payload:\n${JSON.stringify({files: readablePayload})}`);

            try {
                //files.length is 0 for some reason
                const files = Array.isArray(request.payload.files) ? request.payload.files : [request.payload.files];
                for(let i = 0; i < files.length; i++) {
                    const name = files[i].hapi.filename;
                    if(!name.endsWith('.sip.ld') && !name.endsWith('.bootrom.ld')) {
                        return h.response().code(415);
                    }
                }
                for(let i = 0; i < files.length; i++) {
                    const name = files[i].hapi.filename;
                    const dir = name.endsWith('.sip.ld') ? firmwareFilePath : bootromFilePath;
                    files[i].pipe(fs.createWriteStream(path.resolve(dir, name)));
                }

                return h.response().code(200);
            } catch(e) {
                logger.error(e);
                return h.response().code(500);
            }
        },
        config: {
            auth: false,
            payload: {
                output: 'stream',
                allow: 'multipart/form-data',
                maxBytes: 50 * 1000 * 1000
            }

        }
    }
];

export default routes;