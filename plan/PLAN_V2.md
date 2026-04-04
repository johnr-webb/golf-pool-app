# Plan v2

## User Stories

players table w/ odds = espns players w/ scores

- standardization with names
-

users table
id, name

teams table
id, user_id, league_id, picks: [ids],

teams_league_table

leagues table
type: odds,

select \*
from users
join teams
on users.id = teams.user_id
join leagues

players

- /user
  - /create
    - email, (phone), password, teams
  - /resetPassword
  - /login
- /pool
  - /create (limited by scopes "admin" status)
    - pool name, pool password -> poolName, password, createAt, updatedAt, poolId
  - /join
    - adds row
  - /leave
    - removes row
  - /getLeaderboard
    - (before tournament start just return teams, after return teams + scores)
      - be for teams + scores fetches espn, check out ./sample_data.json
- /team
  - /create
    - (select players, comes from initial league setup)
  - /update
    - full replace
  - /get
    return list of players (do we want their scores?)
  - /joinPool
    - just adds a row to the teams_pools db

post(.com/pool/id/createTeam) {
{
teamName: number
playerSelection: []
}
}

ESPN API our player database handshake

- need a common link between the two, we could have a map between players and their espn SLUG
