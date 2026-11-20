# InfoWar Feed — Testing Checklist

## Prerequisites
- [ ] Install Ollama: https://ollama.com/download
- [ ] Pull a model: `ollama pull mistral`
- [ ] Verify Ollama running: `ollama list` should show the model
- [ ] Start the app: `npm run dev`

## Basic Integration
- [ ] Play page loads without errors
- [ ] 4 sidebar tabs visible: Forces / Intel / Combat / Media
- [ ] Media tab shows OllamaStatus bar at top
- [ ] With Ollama running: green dot, shows "Ollama (mistral)"
- [ ] With Ollama stopped: red dot, shows "Disconnected", helpful message
- [ ] ON/OFF toggle works — disabling shows "InfoWar feed disabled"

## Post Generation
- [ ] Start scenario, unpause, let combat happen (Iran fires on US ships)
- [ ] After combat events, posts start appearing in Media tab
- [ ] Posts appear with a realistic delay (not instant — wire services faster, diplomats slower)
- [ ] Posts only show once their simTime has passed (future posts hidden until sim catches up)
- [ ] Multiple persona types generate posts (check for different avatars: IRNA, DOD, RTR, CNN, etc.)
- [ ] Posts are in-character and reference actual game events

## Channel Cards
- [ ] Tweet cards: blue accent, @handle style, compact
- [ ] News ticker cards: red, ALL CAPS, BREAKING prefix
- [ ] Radio cards: amber, italic, "RADIO INTERCEPT" header
- [ ] Telegram cards: Telegram blue accent
- [ ] Forum/Reddit cards: amber, informal style
- [ ] Newspaper/wire cards: formal, attributed

## Era Filtering (requires editing scenario startTime)
- [ ] Change `demoScenario` startTime to `"1988-04-18T06:00:00Z"` (Operation Praying Mantis era)
- [ ] Verify: NO tweets, telegram, reddit posts appear
- [ ] Verify: cable news tickers, radio broadcasts, wire bulletins, newspaper headlines DO appear
- [ ] Change back to 2026 date — tweets and modern channels return

## Edge Cases
- [ ] Game runs at normal framerate with Ollama generating in background
- [ ] Rapid combat (multiple missiles hitting) doesn't flood the feed (dedup working)
- [ ] Pausing the game doesn't re-trigger posts for old events
- [ ] Resuming after pause picks up new events correctly
- [ ] Reset simulation clears the media feed
- [ ] Feed caps at 200 posts (scroll through a long session)

## Without Ollama (graceful degradation)
- [ ] Game works perfectly with Ollama not installed/not running
- [ ] No console errors related to InfoWar
- [ ] Media tab shows connection status and instructions
- [ ] All other tabs (Forces/Intel/Combat) unaffected
