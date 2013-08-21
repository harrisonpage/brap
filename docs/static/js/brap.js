/*
 * https://github.com/harrisonpage/brap
 */

/*
 * Courtesy of Google: Smoosh key/value pairs sent in URL into qs object
 */

var qs=function(e){if(e=="")return{};var t={};for(var n=0;n<e.length;++n){var r=e[n].split("=");if(r.length!=2)continue;t[r[0]]=decodeURIComponent(r[1].replace(/\+/g," "))}return t}(window.location.search.substr(1).split("&"))

/*
 * Values fetched from config.json
 */

var aliases = {};
var icons = {};
var deref, lat, lon, loc;
var nightmode = false;
var imagecount = 0;
var imageQueue = [];

/*
 * Escape strings
 */

var entities = 
{
    '"': '&quot;',
    "'": '&#39;',
    "<": "&lt;",
    ">": "&gt;",
    "/": '&#x2F;',
    "&": "&amp;"
};

function escaped (string)
{
    return String(string).replace
    (
        /[";<>\/&]/g, 
        function (s) 
        {
            return entities[s];
        }
    );
}

function getNextImageID()
{
    return imagecount++;
}

/*
 * Generate link with optional deferer service 
 */

function link (url, label)
{
    var link = (deref == undefined ? "" : deref) + url;
    var buf = "<a target='_blank' href='" + escaped(link) + "'>" + escaped(label) + "</a>";

    if (url.match(/\.(gif|jpg|jpeg|png)$/) != null)
    {
        var id = getNextImageID();
        buf += "<div id='img" + id + "' style='display:none'></div>";
        imageQueue.push ( { id: id, url: url, link: link } );
    }

    return buf;
}

/*
 * Apply markup to chatline: clickable links/hashtags
 */

function render_line (body)
{
    var words = body.split (" ");
    var list = [];
    for (var i = 0; i < words.length; i++)
    {
        var word = words[i];

        if (word.substr (0, 7) == 'http://' || word.substr (0, 8) == 'https://')
        {
            // clickable links
            list.push (link (word, word));
        }
        else if (word.substr (0, 1) == '#')
        {
            // clickable hashtags
            list.push (link ("https://twitter.com/search?q=" + word, word));
        }
        else
        {
            list.push (escaped(word));
        }
    }
    return list;
}

/*
 * Draw username + chatline + timestamp
 */

function decorate_line (when, from, line)
{
    var whom = from;

    if (aliases.hasOwnProperty(from))
    {
        whom = aliases[from];
    }

    if (icons.hasOwnProperty (whom))
    {
        var width = icons[whom]['width'];
        var height = icons[whom]['height'];
        var image = icons[whom]['image'];
        var style = "background-size: " + width + "px " + height + "px; background-image: url(" + image + "); display: block;";
        return "<li class='striped' style='" + style + "'>" + 
            "<span class='pretty from'>" + (from == '_default' ? 'server:' : from) + "</span>" + 
            "<span class='when options'>" + when + "</span>" + 
            "<br/>" + 
            line + 
            "</li>";
    }

    return "<li>" + 
        "<span class='msg striped chat'>&lt;" + from + "&gt;</span>" + 
        " " + 
        line + 
        " " + 
        "<span class='when options'>" + when + "</span></li>";
}

function decorate_server_message (line)
{
    return decorate_line ('', '_default', line);
}

/*
 * Pretty-print date/time
 */

Date.prototype.stdTimezoneOffset = function() 
{
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}

Date.prototype.dst = function() 
{
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
}

// format: Tue Aug 20 2013 16:31:02 GMT-0700 (PDT)
function prettyPrintDate (date)
{
    return getDate(date);
}

// format: Aug 20 16:31:02
function prettyPrintDateTime (date)
{
    var ds = getDate(date);
    var chunks = ds.split (" ");
    return chunks[1] + " " + chunks[2] + " " + chunks[4];
}

// format: 16:31:02
function prettyPrintTime (date)
{
    var ds = getDate(date);
    var chunks = ds.split (" ");
    return chunks[4];
}

function getDate(date) 
{
    var d = new Date(date*1000);
    d.setTime(d.valueOf() - (60000 * d.getTimezoneOffset()) - (d.dst() ? 60000 * 60 : 0));
    return d.toString();
}

/*
 * Apply formatting to chatline
 */

function process_chatline (v, i)
{
    var when = prettyPrintTime (v['date']);
    var list = render_line (v['body']);
    var msg = v['from'] == '' 
        ? decorate_server_message (v['body'])
        : decorate_line (when, v['from'], list.join (" "));
    msg = msg.replace(/\n/g, "<br />");
    if (v['type'] == 'private')
    {
        msg = '<li><span class="msg striped private">' + msg + '</span></li>';
    }
    return msg;
}

/*
 * Defaults for various devices
 */

var limits = 
{
    '320x548': 5, // iPhone 5
    '320x460': 4, // iPhone 4
};

function getDefaultLimit()
{
    if (limits[screen.availWidth + "x" + screen.availHeight] != undefined)
    {
        return limits[screen.availWidth + "x" + screen.availHeight]; 
    }
    return 10;
}

var max = qs.hasOwnProperty('limit') ? qs['limit'] : getDefaultLimit();

/*
 * Change favicon as per config.json
 */

function changeFavIcon (url)
{
    if ($("#favicon").length)
    {
        $("#favicon").attr("href", url);
    }
    else
    {
        $('head').append('<link id="favicon" href="' + url + '" rel="shortcut icon" type="image/x-icon" />');
    }
}

/*
 * Fired when /config.json is loaded 
 */

function onConfigLoaded (config)
{
    /*
     * Change markup based on config values
     */

    if (config.hasOwnProperty('title'))
    {
        document.title = config['title'];
    }

    if (config.hasOwnProperty('favicon'))
    {   
        changeFavIcon (config['favicon']);
    }

    if (config.hasOwnProperty('geolocation') && config['geolocation'] == 'enabled' && navigator.geolocation)
    {
        navigator.geolocation.getCurrentPosition (onPositionUpdate);
    }

    if (config.hasOwnProperty('icons'))
    {
        icons = config['icons'];
    }
    
    if (config.hasOwnProperty('aliases'))
    {
        aliases = config['aliases'];
    }

    if (config.hasOwnProperty('deref'))
    {
        deref = config['deref'];
    }

    /*
     * Get chatlines
     */
    $.ajax
    (
        {
            url: '/get',
            dataType: 'json',
            success: onChatLoaded
        }
    );

    /*
     * UI callbacks
     */

    $("#tab_chat").click ( function() { onChatButtonClicked ('container_chat') } );
    $("#tab_users").click ( function() { onUsersButtonClicked ('container_users') } );
    $("#tab_msg").click ( function() { onMessageButtonClicked ('container_msg') } );
    $("#tab_images").click ( function() { onImagesButtonClicked ('container_images') } );
    $("#tab_links").click ( function() { onLinksButtonClicked ('container_links') } );
    $("#tab_night").click ( function() { toggleNightMode() } );
    $("#tab_settings").click ( function() { onSettingsButtonClicked ('container_settings') } );
    $("#tab_refresh").click ( function() { document.location = "/" } );
}

/*
 * UI actions
 */

function onChatButtonClicked (pane)
{
    hidePanels (pane);
}

function onUsersButtonClicked (pane)
{
    hidePanels (pane);
}

function onImagesButtonClicked (pane)
{
    hidePanels (pane);
    $("#image_viewer").html ("");

    if (imageQueue.length)
    {
        var id, url, link;
        var img = [];
        for (var i = 0; i < imageQueue.length; i++)
        {
            id = imageQueue[i]['id'];
            url = imageQueue[i]['url'];
            link = imageQueue[i]['link'];
            img[i] = new Image();
            img[i].border = 0;
            img[i].width = 120;
            img[i].vspace = 4;
            img[i].hspace = 4;
            img[i].src = url;
            $("#image_viewer").append ("<a target='_blank' href='" + link + "'>" + img[i] + "</a><br clear='left'/>");
        }
    }
    else
    {
        $("#image_viewer").html ("No images");
    }
}

function onMessageButtonClicked (pane)
{
    hidePanels (pane);
    $("#msg_viewer").html ("Loading...");
    $.ajax
    (
        {
            url: '/priv',
            dataType: 'json',
            success: onPrivateMessagesLoaded
        }
    );
}

function onLinksButtonClicked (pane)
{
    hidePanels (pane);
    $("#link_viewer").html ("Loading...");
    $.ajax
    (
        {
            url: '/urls',
            dataType: 'json',
            success: onURLsLoaded
        }
    );
}

function onRefreshButtonClicked (pane)
{
    toggleNightMode();
}

function onSettingsButtonClicked (pane)
{
    hidePanels (pane);
    showInfo();
}

/*
 * Helper: Hide all panels except for the one specified in pane
 */

function hidePanels (pane)
{
    $('.pane').each
    (
        function (i, p)
        {
            p.id == pane ? $(p).show() : $(p).hide();
        }
    );
}

/*
 * Finished loading list of URLs from server
 */

function onURLsLoaded (data)
{
    var urls = [];
    for (var i in data)
    {
        urls.push 
        (
            decorate_line 
            (
                prettyPrintDateTime (data[i]['date']), 
                data[i]['from'], 
                data[i]['url']
            )
        );
    }
    if (urls.length)
    {
        $("#link_viewer").html ("<ul>" + urls.reverse().join ("") + "</ul>");
    }
    else
    {
        $("#link_viewer").html ("No URLs");
    }
}

/*
 * Finished loading private messages/mentions from server
 */

function onPrivateMessagesLoaded (data)
{
    var msg, msgs = [];
    for (var i in data['privmsgs'])
    {
        msg = data['privmsgs'][i];
        msgs.push
        (
            decorate_line
            (
                prettyPrintDateTime (msg['date']),
                msg['from'],
                msg['body']
            )
        );
    }
    if (msgs.length)
    {
        $("#msg_viewer").html ("<ul>" + msgs.join ("") + "</ul>");
    }
    else
    {
        $("#msg_viewer").html ("No messages or mentions");
    }
}

/*
 * Finished loading chat lines from server
 */

function onChatLoaded (data)
{
    /*
     * Hmm: Something bad happened
     */

    if (! data.hasOwnProperty('state')) 
    {
        console.log ("Bogus reply from server");
        return;
    }

    /*
     * Iterate over chatlines, apply formatting
     */

    var chatlines = $.map
    (
        data['pubmsgs'],
        process_chatline
    );

    /*
     * Remove excess
     */

    while (chatlines.length > max)
    {
        chatlines.shift();
    }

    /*
     * Update user list UI
     */

    $('#user_viewer').html ("<ul>" + getUserList (data['state']['whom']) + "</ul>");

    /*
     * Update chatlines 
     */

    $('.console').html
    (
        "<ul>" + 
        chatlines.join ("")  + 
        "</ul>"
    );

    /*
     * Debug info
     */

    $('#state').html 
    (
        pair ("Connected", prettyPrintDate (data['state']['create_date'])) + "<br/>" + 
        pair ("Updated", prettyPrintDate (data['state']['update_date'])) + "<br/>" + 
        pair ("Room", escaped (data['options']['room'])) + "<br/>" + 
        pair ("Subject", (data['state']['subject'] == undefined ? "-none-" : escaped (data['state']['subject']))) + "<br/>" + 
        pair ("Nick", escaped (data['options']['nick'])) + "<br/>" + 
        pair ("JID", escaped (data['options']['jid'])) + "<br/>" + 
        pair ("Dimensions", screen.availWidth + "x" + screen.availHeight) + "<br/>" + 
        pair ("Chatlines", escaped (data['chatlines']))
    );

    /*
     * Focus text input field for non-iOS, otherwise device keyboard pops up
     */

    if (navigator.userAgent.indexOf ('iPhone') == -1)
    {
        $("#line").focus();
    }
}

/*
 * Generate users pane
 */

function getUserList (idiots)
{
    var users = [];
    for (var idiot in idiots)
    {
        users.push (idiot);
    }
    users.sort (sort);
    var buf = "";
    for (var i = 0; i < users.length; i++)
    {
        buf += decorate_line ('', users[i], '');
    }
    return buf;
}

function sort (a, b)
{
  var c = a.toLowerCase();
  var d = b.toLowerCase(); 
  return ((c < d) ? -1 : ((c > d) ? 1 : 0));
}

/*
 * Pretty-print key/value pairs
 */

function pair (key, value)
{
    return "<span class='key'>" + key + ":" + "</span>" + "&nbsp;" + value;
}

/*
 * Google returns street address
 */

function onAddressUpdate (data, lat, lon)
{
    loc = data.results[0].formatted_address;
    $('input[name="loc"]').val (loc);
    $.ajax
    (
        {
            url: '/geo?loc=' + loc + '&lat=' + lat + '&lon=' + lon,
            success: function(_data) 
            {
                // console.log ("sent: " + loc + " => " + lat + "," + lon);
            }
        }
    );
}

/*
 * Browser makes lat/lon available
 */

function onPositionUpdate (position)
{
    lat = position.coords.latitude;
    lon = position.coords.longitude;
    $('input[name="lat"]').val (lat);
    $('input[name="lon"]').val (lon);

    $.ajax
    (
        { 
            url:'http://maps.googleapis.com/maps/api/geocode/json?latlng=' + lat + ',' + lon + '&sensor=true',
            success: function (data)
            {
                onAddressUpdate (data, lat, lon);
            }
        }
    );
}

/*
 * Toggle Info Pane
 */

function showInfo()
{
    $('#geo').html 
    (
        pair ("Lat/Lon", lat + "," + lon) + "<br/>" + 
        pair ("Address", loc)
    );
}

/*
 * Toggle Day/Night Mode
 */

function toggleNightMode()
{
    $('body').removeClass (getMode());
    $('a').removeClass (getMode());
    nightmode = ! nightmode;
    $('body').addClass (getMode());
    $('a').addClass (getMode());

    if (nightmode)
    {
        $("#line").css ({'background-color': '#000', 'color': '#fff'});
    }
    else
    {
        $("#line").css ({'background-color': '#fff', 'color': '#000'});
    }
    $.cookie("nightmode", nightmode ? 1 : 0);
}

function getMode()
{
    return nightmode ? 'night' : 'day';
}

$(document).ready
(
    function() 
    {
        /*
         * Day/Night: Change colors, button label
         */

        nightmode = $.cookie ("nightmode") == '1';
        $("body").addClass (nightmode ? 'night' : 'day');
        $("a").addClass (nightmode ? 'night' : 'day');
        $("#modeLabel").html (nightmode ? "Day" : "Night");

        /*
         * More/Less button
         */

        if (qs.hasOwnProperty('limit'))
        {
            $("#moreButton").attr("href", "/");
            $("#moreLabel").html ("Less");
        }
    
        var tabCount = $(".tab").size() 
        var tabWidth = Math.floor (($("#tabs").width() / tabCount) - (tabCount*2));
        $('.tab').each
        (
            function (i, tab)
            {
                $(tab).css ("width", tabWidth + "px");
            }
        );

        /*
         * Kick off UI callbacks
         */

        $.ajax
        (
            {
                url: '/config',
                dataType: 'json',
                success: onConfigLoaded
            }
        );
    }
);
