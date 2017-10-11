require('dotenv').config()
var builder=require('botbuilder');
var request = require('request');
var serviceNow = require("service-now");
var restify = require('restify');
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 8080, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});
// Listen for messages from users 
server.post('/api/messages', connector.listen());
//console.log(process.env.ITSM_ENDPOINT,process.env.ITSM_ACCOUNT,process.env.ITSM_PASSWORD);


var bot = new builder.UniversalBot(connector, [
    function (session) {
        session.send("Welcome to the NTTMicroBot");
        session.beginDialog('createIncident');
    }
    
]);

// Dialog to ask for a date and time
bot.dialog('createIncident', [
    // Verifies entry into Conversation
    function (session) {
        //builder.Prompts.choice(session, 'I have understood that you want to create a new Ticket, is that correct?', isThatCorrect);
        builder.Prompts.choice(session, "I have understood that you want to create a new Ticket, is that correct?", "Yes|No", {listStyle: builder.ListStyle.button});
        
    },
    // if the response is negative, returns to default dialog; if positive: ask for a keyword (possible keywords listed in categories.json
    function (session, results) {
        var confirmation = results.response.entity.toString();
        categories = require('./categories.json');
        if (confirmation === 'no') {
            session.endDialog('Ok! So how can I help you?');
        } else {
            builder.Prompts.choice(session, 'Okay! So let\'s start with a keyword. What is the application, product or service that you want to open a ticket for?', categories, {listStyle: builder.ListStyle.button});
        }
    },
    // Returns a list of choices for the selected category
    function (session, results) {
        session.dialogData.keyword = results.response.entity.toString();
        session.send(session.dialogData.keyword + " huh? I always struggle with that, too.");
        var choices = categories[session.dialogData.keyword];
        builder.Prompts.choice(session, 'Please specify one of the following categories:', choices, {listStyle: builder.ListStyle.button});
    },
    // Asks for a short description
    function (session, results) {
        session.dialogData.subcategory = results.response.entity;
        builder.Prompts.text(session, 'Your choice was: ' + session.dialogData.subcategory + '. So let\'s move on with a short description. What do you need exactly? In just a few words.');
    },
    // Asks for a description
    function (session, results) {
        session.dialogData.short_description = results.response;
        builder.Prompts.text(session, 'Now that doesn\'t sound too bad. I am sure we\'ll resolve this quickly. Is there anything you would want to add in a more elaborate description?');
    },
    // Asks for a phone number
    function (session, results) {
        session.dialogData.description = results.response;
        builder.Prompts.text(session, 'Ok, now I\'m positive that this will be done in an instant! Just let me know under which phone number you would want to be contacted.');
    },
    // Asks for verification of data, sends HTTP-request if positive
    function (session, results) {
        session.dialogData.phone_nr = results.response;
        builder.Prompts.choice(session, 'Looks good! So you want to submit a Ticket about ' + session.dialogData.keyword + ', the underlying category is ' + session.dialogData.category +
            ' with a short description of \'' + session.dialogData.short_description + '\'. And for further information, we can reach you under ' +
            session.dialogData.phone_nr + '. Am I correct?', "Yes|No", {listStyle: builder.ListStyle.button});
    },
    function (session, results) {
        var confirmation = results.response.entity.toString();
        if (confirmation === 'no') {
            session.send('OK NOW I AM UPSET! Ask someone else. >:(')
        }
        else if (confirmation === 'Yes') {
            session.send('Nice! I will get to work. Don\'t worry, I will get back to you when there are any news.');
            var data = {
                "caller_id": "javascript:gs.getUser().getFullName()",
                "category": session.dialogData.keyword.toString(),
                "subcategory": session.dialogData.subcategory.toString(),
                "short_description": session.dialogData.short_description.toString(),
                "description": session.dialogData.description.toString(),
                "u_phone": session.dialogData.phone_nr.toString()
            };
            
            
            var urlString = 'https://dev15505.service-now.com/api/now/v1/table/incident';
            var options = {
                url: urlString,
                method: 'POST',
                json: true,
                body: data,
                Accept: 'application/json',
                Type: 'application/json',
                auth: {
                    'user': 'admin',
                    'pass': 'F6N6bCdSKv3V'
                }
            };

            //noinspection JSAnnotator
            function callback(error, response, body) {
                if (!error && response.statusCode === 201) {

                    session.send("Incident record created! The number is: " + body.result.number);
                }
            }

            request(options, callback);
        } else {
            session.send('I am confuuuuused. :(')
        }
        session.endDialog();

    }]).triggerAction({matches: 'openTicket'})
    .cancelAction('cancelAction', 'Okay, action canceled.', {matches: /^cancel$/i, confirmPrompt: "Are you sure?"})
    .reloadAction('startOver', 'Ok, starting over.', {matches: /^start over$/i, confirmPrompt: "Are you sure?"});
