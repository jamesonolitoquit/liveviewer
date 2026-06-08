import browser from 'webextension-polyfill'

browser.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await browser.tabs.sendMessage(tab.id, { type: 'RUN_AUDIT' })
  }
})
