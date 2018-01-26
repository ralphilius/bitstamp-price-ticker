var last_values = [],
    refresh_interval = 30000,
    set_interval_id = 0,
notify = function (title, msg) {
    var date = new Date(),
        hour = date.getHours(),
        minute = date.getMinutes(),
        day = date.getDate(),
        month = date.getMonth() + 1,
        year = date.getFullYear();
    if (minute < 10) {
        minute = '0' + minute;
    }
    if (hour < 10) {
        hour = '0' + hour;
    }
    if (day < 10) {
        day = '0' + day;
    }
    if (month < 10) {
        month = '0' + month;
    }
    var date_str = hour + ':' + minute + ' ' + day + '.' + month + '.' + year;
    return chrome.notifications.create('', {
        type: "basic",
        title: title,
        message: msg,
        contextMessage: date_str,
        iconUrl: "icon.png"
    }, function (notifid) {});
},
get_multiplier = function () {
    var value = store.get('multiplier');
    if (value === undefined) {
        return 1;
    }
    return value;
},
get_last_value = function () {
    return store.get('last-value');
},
get_precision = function () {
    var value = store.get('precision');
    if (value === undefined) {
        return 1;
    }
    return value;
},
get_within = function () {
    return store.get('within') || 10;
},
get_currency_pair = function(){
	var value = store.get('currency-pair');
	if (value === undefined) {
        return "BTCUSD";
    }
	return value;
},
store_string = function(name, value){
	store.set(name, value);
},
store_float = function (name, value, default_value) {
    value = parseFloat(value);
    if (isNaN(value)) {
        value = default_value;
    }
    store.set(name, value);
},
store_int = function (name, value) {
    value = parseInt(value, 10);
    if (isNaN(value)) {
        value = 1;
    }
    store.set(name, value);
},
_formatter = function(num) {
    return num > 1999 ? (num/1000).toFixed(1) + 'k' : num.toFixed(get_precision());
},
reload_badge = function (manual) {
    if (manual && set_interval_id) {
        clearInterval(set_interval_id);
        set_interval_id = setInterval(reload_badge, refresh_interval);
    }
    $.getJSON("https://www.bitstamp.net/api/v2/ticker/"+get_currency_pair().toLowerCase()+"/", function (data) {
        if (!data && !data.last) {
            return;
        }
        var value = parseFloat(data.last),
            last_value = get_last_value() || value,
            last_max = store.get('last-max') || value,
            last_min = store.get('last-min') || value,
            badge_value = value * get_multiplier();
        if (value === last_value) {
            chrome.browserAction.setBadgeBackgroundColor({
                color: [0, 0, 0, 150]
            });
        } else if (value > last_value) {
            chrome.browserAction.setBadgeBackgroundColor({
                color: [0, 150, 0, 150]
            });
        } else {
            chrome.browserAction.setBadgeBackgroundColor({
                color: [255, 0, 0, 255]
            });
        }
		var baseCurrency = get_currency_pair().substring(0,3);
		var xchangeCurrency = get_currency_pair().substring(3,get_currency_pair().length);
        chrome.browserAction.setTitle({
            'title': '1 '+baseCurrency+' = ' + _formatter(value) + ' ' + xchangeCurrency
        });
        chrome.browserAction.setBadgeText({
            'text': _formatter(badge_value)
        });
        store_float('last-value', value);
        if (store.get('notification-max') && value > last_max) {
            store.set('last-max', value);
            notify('New maximum ETH price', 'The highest price is now ' + value);
            $('#last_max').val(value);
        }
        if (store.get('notification-min') && value < last_min) {
            store.set('last-min', value);
            notify('New minimum ETH price', 'The lowest price is now ' + value);
            $('#last_min').val(value);
        }
        if (store.get('notification-diff') && store.get('last-diff')) {
            var within = get_within();
            last_values.push(value);
            if (last_values.length > within) {
                last_values.shift();
            }
            var max = Math.max.apply(Math, last_values),
                min = Math.min.apply(Math, last_values),
                abs = Math.round(Math.abs(max - min) * 100) / 100,
                last_diff = store.get('last-diff'),
                title;
            if (abs > last_diff) {
                if (max === value) {
                    title = 'Price rose from ' + min + ' to ' + max;
                    abs = '+' + abs;
                } else {
                    title = 'Price fell from ' + max + ' to ' + min;
                    abs = '-' + abs;
                }
                last_values = [value];
                notify(title, 'Within ' + within + ' fetches/minutes price changed ' + abs + ' USD.');
            }
        }
    });
},
save_options = function () {
    var multiplier = $('#multiplier').val(),
        precision = $('#precision option:selected').val(),
        within = $('#within option:selected').val(),
        last_max = $('#last_max').val(),
        last_min = $('#last_min').val(),
        last_diff = $('#last_diff').val();
    store_float('multiplier', multiplier, 1);
    store_int('precision', precision, 1);
    store_int('within', within, 10);
    store_float('last-max', last_max, get_last_value());
    store_float('last-min', last_min, get_last_value());
    store_float('last-diff', last_diff, 5);
    $('input[type=checkbox]').each(function () {
        var elem = $(this),
            id = elem.attr('id'),
            checked = elem.prop('checked');
        store.set(id, checked);
    });
    load_options();
    reload_badge(1);
},
load_options = function () {
    $('#multiplier').val(get_multiplier());
    $('#precision option[value=' + get_precision() + ']').prop('selected', true);
    $('#within option[value=' + get_within() + ']').prop('selected', true);
    $('input[type=checkbox]').each(function () {
        var elem = $(this),
            id = elem.attr('id'),
            checked = store.get(id);
        elem.prop('checked', checked);
    });
    $('#last_max').val(store.get('last-max') || get_last_value());
    $('#last_min').val(store.get('last-min') || get_last_value());
    $('#last_diff').val(store.get('last-diff') || 5);
    $('#save').on('click', save_options);
},
popup_click = function(e) {
	var within = e.target.value;
	console.log(e.target.textContent);
	store_string('currency-pair', within);
	chrome.browserAction.setTitle({'title': ''});
	chrome.browserAction.setBadgeText({'text': ''});
	chrome.extension.sendMessage({ msg: "reload_badge" });
	//window.close();
},
load_popup = function(){
	var pairs = ["btcusd", "btceur", "eurusd", "xrpusd", "xrpeur", "xrpbtc", "ltcusd", "ltceur", "ltcbtc", "ethusd", "etheur", "ethbtc", "bchusd", "bcheur", "bchbtc"];
	var html = '<div class="ui middle aligned selection animated list">';
	for (var i=0; i < pairs.length; i++){
		html += '<div class="item pair">';
		html += '<img class="ui avatar image" src="https://coincodex.com/en/resources/images/admin/coins/fucktoken.png:resizebox?56x56">';
		html += '<div class="content">';
		html += '<div class="header">'+pairs[i]+'</div>';
		html += '</div>';
		html += '</div>';
	}
	html+='</div>';
	document.getElementById('injecting').innerHTML = html;
	
	$('input[type=radio]').each(function () {
        var elem = $(this),
            id = elem.attr('id'),
            checked = get_currency_pair() === elem.attr('value');
        elem.prop('checked', checked);
    });
	
	var pairsDivs = document.getElementsByClassName('pair');
	console.log(pairsDivs);
	for (var i = 0; i < pairsDivs.length; i++) {
		pairsDivs[i].addEventListener('click', popup_click);
	}
},
background = function () {
	chrome.extension.onMessage.addListener(
		function(request, sender, sendResponse){
			if(request.msg == "reload_badge") reload_badge(1);
		}
	);
    chrome.browserAction.onClicked.addListener(function (tab) {
        chrome.browserAction.setBadgeBackgroundColor({
            color: [255, 0, 0, 255]
        });
        chrome.browserAction.setBadgeText({
            'text': '...'
        });
        reload_badge(1);
    });
    set_interval_id = setInterval(reload_badge, refresh_interval);
    reload_badge();
};

$(document).ready(function() {
  $.ajaxSetup({
    cache: false
  });
});
