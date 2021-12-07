// eslint-disable-next-line no-undef
var $ = $ || jQuery;
var chatObserver = null;

// if we are in popup
function AC_InPopup() {
  return window.opener && window.opener !== window;
}

// reopen popup in new tab
function AC_OpenInTab() {
  if (AC_InPopup()) {
    window.open(window.location.href, '_blank');
    window.close();
  }
}

// get url parameters from URL
function AC_GetUrlParameter(sParam) {
  var sPageURL = window.location.search.substring(1),
    sURLVariables = sPageURL.split('&'),
    sParameterName,
    i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split('=');

    if (sParameterName[0] === sParam) {
      return typeof sParameterName[1] === undefined
        ? true
        : decodeURIComponent(sParameterName[1]);
    }
  }
  return false;
}

// detect insertions into container, and invoke the callback
function AC_SelectOnInsertion(containerSelector, tags, callback) {
  if (chatObserver) {
    chatObserver.disconnect();
  }

  var insertionObserver = function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
        for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
          var tagName = mutation?.addedNodes[i]?.tagName?.toLowerCase();
          if (tags.map((item) => item.toLowerCase()).includes(tagName)) {
            callback(mutation.addedNodes[i], tagName);
          }
        }
      }
    });
  };

  var target = document.querySelectorAll(containerSelector)[0];
  var config = { childList: true, subtree: true };
  var MutationObserver =
    window.MutationObserver || window.WebKitMutationObserver;
  chatObserver = new MutationObserver(insertionObserver);
  chatObserver.observe(target, config);
}

// get domain name from location
function AC_GetDomainName() {
  return window.location.hostname
    .split('.')
    .slice(-2)
    .join('.')
    .split('.')[0]
    .toLowerCase();
}

// post message to iframe
function AC_PostMessageSouthBound(action, payload = undefined) {
  // post the data to the remote window
  const data = {
    type: 'avidcaster-chat-south-bound',
    host: AC_GetDomainName(),
    streamId: AC_GetStreamUid(),
    action,
    payload,
  };

  document
    .getElementById('avidcaster-iframe')
    .contentWindow.postMessage(data, '*');
}

// listen to dom changes, and highlight the new comments if selected keywords are found
function AC_ListenForNewChat(container, selectors) {
  AC_SelectOnInsertion(container, selectors, function (element, tagName) {
    // console.log(`highlighting new msg: ${$(element).html()}`);
    AC_PostMessageSouthBound('chat', {
      tagName,
      html: $(element).html(),
    });
  });
}

// get unique id for youtube stream
function AC_GetYoutubeUid() {
  return AC_GetUrlParameter('v');
}

// get unique id for twitch stream
function AC_GetTwitchUid() {
  var match = window?.location?.href?.match(
    /^.*twitch.*\/popout\/*(.*)\/chat.*$/
  );
  if (match?.length) {
    return match[1];
  }
  return '';
}

// get unique id for stream
function AC_GetStreamUid() {
  var uId = '';
  var target = AC_GetDomainName() || 'youtube';
  switch (target) {
    case 'youtube':
      uId = AC_GetYoutubeUid();
      break;
    case 'twitch':
      uId = AC_GetTwitchUid();
      break;
    default:
      break;
  }
  return uId;
}

// insert iframe - ci, dev or prod
function AC_InsertIframe(container = 'body') {
  if (!$(container).find('#avidcaster-iframe').length) {
    $('#avidcaster-iframe').remove();

    var server = 'avidcaster.net';

    if (AC_GetUrlParameter('ci') === 'true') {
      server = 'ci.avidcaster.net';
    } else if (AC_GetUrlParameter('dev') === 'true') {
      server = 'dev.avidcaster.net:80';
    }

    $(container).append(
      `<iframe id="avidcaster-iframe" src="https://${server}/chat/iframe"></iframe>`
    );
  }
}

// listen to incoming actions by the remote window (avidcaster)
function AC_ListenToChild() {
  window.addEventListener(
    'message',
    (event) => {
      if (event.data.type === 'avidcaster-chat-north-bound') {
        switch (event.data.action) {
          case 'observe':
            AC_ListenForNewChat(
              event.data.payload.container,
              event.data.payload.selectors
            );
            console.log(
              `Observing for new chat on: ${event.data.payload.container}`
            );
            break;
          case 'ping':
            AC_PostMessageSouthBound('pong');
            console.log(`Ping received, Pong sent`);
            break;
          case 'iframe':
            AC_InsertIframe(event.data.payload.container);
            console.log(`Append iframe to ${event.data.payload.container}`);
            break;
          default:
            break;
        }
      }
    },
    false
  );
}

//  function invocation goes below this line ONLY
////////////////////////////////////////////////////////////////////////////////

// if we are in a popup, reopen in new tab
AC_OpenInTab();

// listen to incoming actions by the remote window (avidcaster)
AC_ListenToChild();

setTimeout(function () {
  // insert iframe, allowing for jquery to load
  AC_InsertIframe();
}, 1000);
