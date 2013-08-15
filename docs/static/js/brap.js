/*
 * Courtesy of Google: Smoosh key/value pairs sent in URL into qs object
 */

var qs=function(e){if(e=="")return{};var t={};for(var n=0;n<e.length;++n){var r=e[n].split("=");if(r.length!=2)continue;t[r[0]]=decodeURIComponent(r[1].replace(/\+/g," "))}return t}(window.location.search.substr(1).split("&"))

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

/*
 * Values fetched from config.json
 */

var aliases = {};
var icons = {};
var deref, lat, lon, loc;
var nightmode = false;

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

/*
 * Generate link with optional deferer service 
 */

function link (url, label)
{
    if (deref == undefined)
    {
        return "<a target='_blank' href='" + escaped(url) + "'>" + escaped(label) + "</a>";
    }
    return "<a target='_blank' href='" + deref + escaped(url) + "'>" + escaped(label) + "</a>";
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
        return "<li style='" + style + "'>" + 
            "<span class='pretty from'>" + (from == '_default' ? 'server:' : from) + "</span>" + 
            "<span class='when options'>" + when + "</span>" + 
            "<br/>" + 
            line + 
            "</li>";
    }

    return "<li>" + 
        "<span class='msg chat'>&lt;" + from + "&gt;</span>" + 
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

function prettyprint_date (date)
{
    return _prettyprint_date (date, false);
}

function prettyprint_time (date)
{
    return _prettyprint_date (date, true);
}

function _prettyprint_date (date, flag)
{
    var d = new Date(date*1000);
    d.setTime(d.valueOf() - (60000 * d.getTimezoneOffset()) - (d.dst() ? 60000 * 60 : 0));
    var ds = d.toString();
    var chunks = ds.split (" ");
    return flag ? chunks[4] : ds;
}

/*
 * Apply formatting to chatline
 */

function process_chatline (v, i)
{
    var when = prettyprint_time (v['date']);
    var list = render_line (v['body']);
    var msg = v['from'] == '' 
        ? decorate_server_message (v['body'])
        : decorate_line (when, v['from'], list.join (" "));
    msg = msg.replace(/\n/g, "<br />");
    if (v['type'] == 'private')
    {
        msg = '<li><span class="msg private">' + msg + '</span></li>';
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
}

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
     * Extract user list from payload
     */

    var idiots = Object.keys(data['state']['whom']).join (", ");

    /*
     * Iterate over chatlines, apply formatting
     */

    var chatlines = $.map
    (
        data['msgs'],
        process_chatline
    );

    /*
     * Remove excess chatlines
     */

    while (chatlines.length > max)
    {
        chatlines.shift();
    }

    /*
     * Update user list UI
     */

    $('#bar').html (idiots);

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
        pair ("Created", prettyprint_date (data['state']['create_date'])) + "<br/>" + 
        pair ("Updated", prettyprint_date (data['state']['update_date'])) + "<br/>" + 
        pair ("Nick", escaped (data['options']['nick'])) + "<br/>" + 
        pair ("JID", escaped (data['options']['jid'])) + "<br/>" + 
        pair ("Room", escaped (data['options']['room'])) + "<br/>" + 
        pair ("Subject", escaped (data['state']['subject'])) + "<br/>" + 
        pair ("Chatlines", escaped (data['chatlines']))
    );
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
    if ($('#info').is(":visible"))
    {
        $('#info').hide();
        return;
    }

    $('#geo').html 
    (
        "<span class='key'>Lat/Lon:</span>&nbsp;" + lat + "," + lon + "<br/>" + 
        "<span class='key'>Location:</span>&nbsp;" + loc
    );

    $('#info').show();
}

/*
 * Toggle Day/Night Mode
 */

function toggleMode()
{
    $("body").removeClass (nightmode ? 'night' : 'day');
    $('a').removeClass (nightmode ? 'night' : 'day');
    nightmode = ! nightmode;
    $("body").addClass (nightmode ? 'night' : 'day');
    $('a').addClass (nightmode ? 'night' : 'day');
    $("#modeLabel").html (nightmode ? "Day" : "Night");
    if (nightmode)
    {
        $("#line").css ({'background-color': '#111', 'color': '#fff'});
    }
    else
    {
        $("#line").css ({'background-color': '#fff', 'color': '#000'});
    }
    $.cookie("nightmode", nightmode ? 1 : 0);
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
         * Debug stuff
         */

        $('#device').html 
        (
            pair ("Dimensions", screen.availWidth + "x" + screen.availHeight)
        );

        $("#bar").html ("Loading...");

        /*
         * More/Less button
         */

        if (qs.hasOwnProperty('limit'))
        {
            $("#moreButton").attr("href", "/");
            $("#moreLabel").html ("Less");
        }

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
