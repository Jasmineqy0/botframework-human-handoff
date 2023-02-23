const { ActivityTypes, ActionTypes, CardFactory } = require('botbuilder');

const replyMenu = { type: ActivityTypes.Message };

const buttons = [
    { type: ActionTypes.MessageBack, title: 'Check Queue', text: '#list' },
    { type: ActionTypes.MessageBack, title: 'Connect Customer', text: '#connect' },
    { type: ActionTypes.MessageBack, title: 'Disconnect Customer', text: '#disconnect' }
];

const menuCard = CardFactory.heroCard('Agent Menu', undefined, buttons);

replyMenu.attachments = [menuCard];

exports.replyMenu = replyMenu;
