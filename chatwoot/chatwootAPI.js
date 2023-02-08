/* eslint-disable camelcase */
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http');

app.use(bodyParser.json());

// const [source_id, pubsub_token] = await create_contact(chatwoot_host, chatwoot_port, client_id, client_name, inbox_id);
// cookie.source_id = source_id;
// cookie.pubsub_token = pubsub_token;

// const conversation_id = await create_conversation(chatwoot_host, chatwoot_port, client_id, client_name, inbox_id, source_id);
// cookie.conversation_id = conversation_id;

// await create_message(chatwoot_host, chatwoot_port, inbox_id, cookie.source_id, cookie.conversation_id, "Hi, I'm a client");

async function create_contact(chatwoot_host, chatwoot_port, client_id, client_name, inbox_id) {
    console.log('------------- creating contact -------------');
    const api = `/public/api/v1/inboxes/${ inbox_id }/contacts`;

    const req_body = {
        'identifier': client_id,
        'identifier_hash': '',
        'email': `${ client_name }@test.de`,
        'name': client_name,
        'phone_number': '',
        'avatar_url': '',
        'custom_attributes': {}
    };
    const res_body = JSON.parse(await chatwoot_post(chatwoot_host, chatwoot_port, api, req_body));
    return [res_body.source_id, res_body.pubsub_token];
}

async function create_conversation(chatwoot_host, chatwoot_port, client_id, client_name, inbox_id, source_id) {
    console.log('------------- creating conversation -------------');
    const api = `/public/api/v1/inboxes/${ inbox_id }/contacts/${ source_id }/conversations`;

    const req_body = {
        'identifier': client_id,
        'identifier_hash': '',
        'email': `${ client_name }@test.de`,
        'name': client_name,
        'phone_number': '',
        'avatar_url': '',
        'custom_attributes': {}
    };
    const res_body = JSON.parse(await chatwoot_post(chatwoot_host, chatwoot_port, api, req_body));
    return res_body.id; // return conversation id
}

async function create_message(chatwoot_host, chatwoot_port, inbox_id, source_id, conversation_id, msg) {
    console.log('------------- creating message -------------');
    const api = `/public/api/v1/inboxes/${ inbox_id }/contacts/${ source_id }/conversations/${ conversation_id }/messages`;

    const req_body = {
        'content': msg,
        'echo_id': ''
    };
    const res_body = JSON.parse(await chatwoot_post(chatwoot_host, chatwoot_port, api, req_body));
    return res_body;
}

async function list_all_message(chatwoot_host, chatwoot_port, inbox_id, source_id, conversation_id) {
    console.log('------------- receiving message -------------');
    const api = `/public/api/v1/inboxes/${ inbox_id }/contacts/${ source_id }/conversations/${ conversation_id }/messages`;

    const res_body = await chatwoot_get(chatwoot_host, chatwoot_port, api);
    return res_body;
}

async function chatwoot_get(chatwoot_host, chatwoot_port, api) {
    const options = {
        method: 'GET',
        host: chatwoot_host,
        port: chatwoot_port,
        path: api,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const request = http.get(options, (response) => {
            let body = '';
            console.log('statusCode:', response.statusCode);
            console.log('headers:', response.headers);
            response.on('data', (chunk) => {
                body += chunk;
                console.log(`BODY: ${ chunk }`);
            });
            response.on('end', () => resolve(body));
        }).on('error', reject);

        request.on('error', (e) => {
            console.error(e);
        });
        request.end();
    });
}

function chatwoot_post(chatwoot_host, chatwoot_port, api, req_body) {
    const options = {
        method: 'POST',
        host: chatwoot_host,
        port: chatwoot_port,
        path: api,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    const payload = JSON.stringify(req_body);

    return new Promise((resolve, reject) => {
        const request = http.request(options, (response) => {
            console.log('statusCode:', response.statusCode);
            // console.log('headers:', response.headers);
            let body = '';
            response.on('data', (chunk) => {
                body += chunk;
                // console.log(`BODY: ${chunk}`);
            });
            response.on('end', () => resolve(body));
        }).on('error', reject);

        request.on('error', (e) => {
            console.error(e);
        });
        request.write(payload);
        request.end();
    });
}

module.exports.create_contact = create_contact;
module.exports.create_conversation = create_conversation;
module.exports.create_message = create_message;
module.exports.list_all_message = list_all_message;
