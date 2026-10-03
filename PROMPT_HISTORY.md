# Space Attack — Codex Prompt History

## Codex Chat 1 — Main Development

### Prompt 1
I’m doing a time-boxed game development calibration task. I have a maximum of 2 hours total including playtesting and reflection, so prioritize a complete, polished, reliable game over ambitious scope.
Build a small browser arcade game called Space Attack using only vanilla HTML, CSS, and JavaScript with the HTML5 Canvas API. Do not use npm, frameworks, libraries, external assets, CDNs, build tools, or anything that requires installation. The finished game should run by opening index.html in a modern desktop browser.
Required features:
- Start screen with game title, controls, and a clear way to start.
- Player-controlled spaceship.
- Keyboard movement using WASD and/or arrow keys.
- Spacebar fires.
- On-screen instructions showing the controls.
- Enemies appear in waves.
- Player bullets collide with and destroy enemies.
- Enemies and/or enemy projectiles can damage the player.
- Visible score.
- Visible health or lives.
- Increasing difficulty as waves progress.
- Game-over screen.
- Ability to restart without refreshing the browser.

I want the game to feel polished despite its small scope. Add lightweight polish where appropriate, such as:
- animated starfield/background
- simple particle/explosion effects
- visual feedback when the player takes damage
- wave number / wave transition messaging
- satisfying shooting and enemy destruction feedback
- a small amount of enemy behavior variation

Sounds:
- Simple arcade-style sound effects for firing, enemy destruction, player damage, and game over.
- Generate these sounds programmatically with the Web Audio API rather than using external audio files or assets.
- Keep them short and subtle: basic retro beeps, pulses, or noise effects are enough.
- Audio should only begin after user interaction so it works correctly with browser autoplay restrictions.
- Sound must not interfere with gameplay or create additional dependencies.

Do NOT add features that threaten completion within the time limit. Avoid things like asset pipelines, complex menus, bosses, upgrade systems, multiplayer, persistence, mobile controls, or elaborate audio systems. Simple programmatically generated arcade sound effects are encouraged.
Keep the code straightforward, readable, and reasonably organized. Avoid unnecessary abstractions.
Before writing code:
1. Briefly state the implementation plan.
2. List the files you intend to create.
3. Call out any design decisions you are making that affect gameplay.
Then implement the complete playable first version.
Once implemented, give me a short manual playtest checklist covering the task requirements and likely failure points.
Do not merely describe code that I should write. Make the required changes directly in the project.

### Prompt 2
I played the game for a while up to wave 10. I did all the manual tests and have found no issues with any of them. While i have some changes and additions in mind, but this is a very solid place to start. I'd say its %90 there. 

Lets go step by step with these. First one: With enemy waves right now: Enemies come in to the screen one by one, lets change so that all enemies for a wave appear all at once. As wave number increase and so the hardship, enemy count in a wave can increase too. Also when the enemies appear all at once in batches, can we make the swarm has the shape of something interesting, like different geometric shapes, like rectangle, square, triangle etc. We can even try doing some complex shapes like platonic solids' 2d representations.
The enemies in the batches should not all be the same ones, each swarm should have a mix of them.

Also a side note when applying all these changes, I did not feel any difficulty at all until the wave 7, so it was kinda boring. Some maybe try to aim for a lil bit more enemy movement, or some evolving firing styles. Lets try to find a good mix of visually good looking particles -enemy fires, due to firing while moving and firing speed/frequency- too. Lets aim for "dancing enemies/dancing swarms of enemies acting together". Keep performance simple and don't restructure working gameplay systems unless necessary.

### Prompt 3
So far so good. A couple of more tweak/polish without changing the entire structure:
*Difficulty is good, i died a few times at wave 7, so can we make it so that harder enemies randomly drop health / hull. these should flow in a normal speed starting from where the enemies die and dropped them and the players has to pick it up. If he misses it (goes out of the screen) then its gone.
*Can we make a fullscreen mode? that upon pressing "F" key makes it fullscreen? (the f11 button in browsers) also, when on fullscreen mode, can we make it so that the space/play screen fills the entire screen? even ultrawide screens? There is no need to change the swarm sized or a need to make them fill the screen. they can stay as it is, i only want the game area/starfield etc filling the screen fully on fullscreen mode. the non-fullscreen mode should stay as it is.
*Can we make enemy explosions just little bit more dramatic, bigger particle area and just a little bit more/far reaching particles.
Keep performance simple and don't restructure working gameplay systems unless necessary.

### Prompt 4
All tested so far and good. A few more things with the difficulty:
*Lets drop the chance of hull repair drops %1 with each wave. ie: wave 1: %25, Wave 2: %24 and so on. After level 25 there should not be any life drops.
*No need to draw/write names of the shapes to the screen, ie reactangle, cube etc. just the wave N, display is fine there.

### Prompt 5
Ok so far so good. So to spice the overall looks, I want to have the player space ship to have some light around it. What i want is basically an  vignette effect, where the %100 brightness is the player ship location. And fill around %70 of the screen with circular shape and some gradient of brightness depending on how far from the ship location. And the rest of the circle in the screen, the %30 outside dark area, (star field, background etc) should be somewhat dimmed. %50 dimmed maybe. I want a nice, dramatic, active look. Keep performance simple and don't restructure working gameplay systems unless necessary.
If this is not feasible to do without doing major rendering changes, fill me in on it and lets decide alternatives and make me decide.

### Prompt 6
This works but can we make the light gradient somewhat smoother than how it is now? I can see the tone-changing lines right now on my screen and its not good looking/distracting.

### Prompt 7
Gradient effect is acceptable now. One more thing: the firing sound of the player gets kinda irritating when constantly fired. Can we do some slight random daviation to the firing sound with each fire?

### Prompt 8
Can we now do same kind of deviation to the sound where enemies explode die? Lets also make their explosions a little bit more imptactful/bigger with this pass.

### Prompt 9
lets fix this fullscreen "F" here and make it like the others pls

### Prompt 10
Now lets a very simple arcade style melody with a few notes to play when the player dies/game over. Lets do it programmatically. A sad beep-y melody with a few notes. not a whole music.

### Prompt 11
Publish this existing SpaceShoter project as a public Codex Site. Do not modify the game unless required for hosting. I need a public URL that reviewers can open without signing in.

