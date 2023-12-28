## Developer's Notes

### How to refresh favicon on phone?

You can add <link rel="apple-touch-icon" href="/custom_icon.png"> so that your favicon is shown when you favorite the page or view it in that tabs view. This is mentioned here.
For the webpage itself its very likely your iPhone is still caching the old icon regardless of your attempts to clear said cache. In my experience trying to load the page with no network connection, waiting for the time out error and then connecting to the network and reloading the page is the best way to "force" the device to clear its cache. Alternatively with the dev tools open and a keyboard attached type command + option + r. If not, patience, it'll update... eventually.

Source: https://stackoverflow.com/questions/75126878/vue-favicon-doesnt-change-in-ios-chrome-safari-browser
