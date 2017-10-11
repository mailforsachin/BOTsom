require('dotenv').config()
var builder=require('botbuilder');
var request = require('request');
var serviceNow = require("service-now");
var restify = require('restify');
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
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
        var card = createHeroCard(session);
        var msg = new builder.Message(session).addAttachment(card);
        session.send(msg);

        session.send('I can help with some of your daily tasks for now');
        session.send("But, I can learn quickly as we interact & help you more in the future")
        session.send('What would you like to do today?')
        builder.Prompts.choice(session, "Please select one of these options", "FAQ|Work with SNOW Tickets|Self Service", {listStyle: builder.ListStyle.button});
    },
        function (session, results) {
            var confirmation = results.response.entity.toString();            
            if (confirmation === 'FAQ') {
                categories = require('./cat.FAQ.json');
                builder.Prompts.choice(session, 'Okay! Here is what I can do!', categories, {listStyle: builder.ListStyle.button});
                session.beginDialog('FAQ');
                
            } else
            if (confirmation === 'Work with SNOW Tickets') {
                categories = require('./cat.Ticket.json');
                builder.Prompts.choice(session, 'Here is what I am capable of doing', categories, {listStyle: builder.ListStyle.button});
                session.beginDialog('SNOW');

            } else 
            if (confirmation === 'Self Service') {
                categories = require('./cat.FAQ.json');
                builder.Prompts.text(session, 'My knowledge is limited here. Here is what I can do for now', categories, {listStyle: builder.ListStyle.button});
                session.beginDialog('SelfService');
            }
    }
    
]);

// Dialog to ask for a date and time
bot.dialog('FAQ', [
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
                    'pass': 'TCmgr4wJuZzY'
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

    bot.dialog('incidentStatus', [
        function (session) {
    
            session.send("Getting your personal incidents...");
            var urlString = 'https://dev27563.service-now.com/api/now/table/incident?sysparm_query=caller_id=javascript:gs.getUserID()^active=true^ORDERBYnumber&sysparm_limit=16';
            var options = {
                url: urlString,
                headers: headers,
                auth: {
                    'user': 'admin',
                    'pass': 'EF3tGqL5T!'
                }
            };
    
            function callback(error, response, body) {
                if (!error && response.statusCode === 200) {
                    var respJSON = JSON.parse(body);
                    session.dialogData.myIncidents = respJSON;
                    var incidentCount = respJSON.result.length;
                    session.send("You currently have " + incidentCount + " incidents.");
                    var choices = [];
                    for (var i = 0; i < respJSON.result.length; i++) {
                        choices[i] = respJSON.result[i].number.toString();
                        session.send("Incident ID number " + (i + 1) + " is: '" + respJSON.result[i].number + "', the short description is: '" + respJSON.result[i].short_description + "'");
                    }
                    builder.Prompts.choice(session, "If you want more information on one of those incidents, ask me about its ID.", choices, buttonStyle);
                }
            }
    
            request(options, callback);
        },
        function (session, results) {
            session.send("Getting Incident data...");
            var incidentID = results.response.entity;
            var urlString = 'https://dev27563.service-now.com/api/now/table/incident?sysparm_query=number=' + incidentID;
            var options = {
                url: urlString,
                headers: headers,
                auth: {
                    'user': 'admin',
                    'pass': 'EF3tGqL5T!'
                }
            };
    
            function callback(error, response, body) {
                if (!error && response.statusCode === 200) {
                    var respJSON = JSON.parse(body);
                    // Displaying an understandable value - 1 High, 3 low
                    var urgency;
                    urgency = respJSON.result[0].urgency;
                    switch (urgency) {
                        case "1":
                            urgency = 'High';
                            break;
                        case "2":
                            urgency = "Medium";
                            break;
                        case "3":
                            urgency = "Low";
                            break;
                        default:
                            urgency = "Unavailable";
                    }
                    // Displaying an understandable value
                    var state;
                    state = respJSON.result[0].state;
                    switch (state) {
                        case "1":
                            state = "New";
                            break;
                        case "2":
                            state = "In Progress";
                            break;
                        case "3":
                            state = "On Hold";
                            break;
                        case "6":
                            state = "Resolved";
                            break;
                        case "7":
                            state = "Closed";
                            break;
                        case "8":
                            state = "Canceled";
                            break;
                        default:
                            state = "Unavailable";
                    }
                    session.send("Requested ID: '" + respJSON.result[0].number + "' <br/>Short Description: '" + respJSON.result[0].short_description + "' <br/>Status: '" + state + "'<br/>Urgency: '" + urgency + "'");
                }
            }
    
            request(options, callback);
        }
    ]).triggerAction({matches: 'ticketStatus'})
        .cancelAction('cancelAction', 'Okay, action canceled.', {matches: /^cancel$/i, confirmPrompt: "Are you sure?"});

function createHeroCard(session) {
    return new builder.HeroCard(session)
        .title('Hello there! My name is NTTMicroBot')
        .subtitle("I am here to help you");
}