## Alex Osler | Multiplayer Snake Game With a Twist
This was all done by Alex Osler

The project is available at https://fp-aposler.herokuapp.com/

My project is pretty similar to my proposal, with some slight changes. For a quick recap,
in my proposal I outlined a multiplayer snake game with up to 10-20 players. The game would feature
a few tweaks, mainly the ability to "eat" the tail of another snake, and there being an
end goal of forming your snake into a certain shape. The only way I have deviated from this outline
is that, when you "eat" an opposing snakes tail, their tail values simply dissapear rather than being
added to yours. This is to avoid the issue of the tail expanding back into opposing players, which
is basically impossible to implement. The features here are rather simple, but hopefully plenty
enjoyable. You enter the game by giving a username, and are then placed into one of potentially multiple
currently ongoing games. You then play like normal until you either contact another snakes head,
contact your own body, or someone achieves the desired shape, which is shown in the top right corner.
When any of these conditions are met, the game ends and you receive a message describing why. In the case
of the first 2, only you and potentially the snake you impacted have your game end, and in the last
situation the entire game is notified and ended. I have included a leaderboard for additional play options
if desired, but I simply did not have the time to explicity code in an endless mode. Hopefully you enjoy
the game!
