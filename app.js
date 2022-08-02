const express = require('express');
const bodyParser = require('body-parser');

const app = express();

const { IgApiClient } = require('instagram-private-api');

const port = process.env.port || 3000;

let info = [];

let accountName = '';

let timeout = 0;

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));
app.use('/css', express.static(__dirname + 'public/css'));
app.use('/images', express.static(__dirname + 'public/images'));

app.set('views', './views');
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index', {info:info, accountName:accountName});

    info = [];
    accountName = '';
});

app.post('/check', (req, res) => {
    accountName = '';
    info = [];

    const username = req.body.username;
    const password = req.body.password;

    if (username == '' || password == ''
     || username.length > 30 
     || username.length < 4 || password.length > 30 || password.length < 5) {
        info[0] = 'Invalid username or password.';

        res.redirect('/');

        return;
    }

    const regex = /^[a-zA-Z0-9_.]+$/;

    if (!regex.test(username)) {
        info[0] = 'Invalid username. (Regex)';

        res.redirect('/');

        return;
    }

    if (!regex.test(password)) {
        info[0] = 'Invalid password. (Regex)';

        res.redirect('/');

        return;
    }

    const now = Date.now();

    if (timeout >= now) {
        const seconds = (timeout - now) / 1000;

        info[0] = 'You are checking too quickly, please wait... (' + seconds + ' seconds)';

        res.redirect('/');

        return;
    }

    info = [];

    timeout = now + 30000;

    const ig = new IgApiClient();

    ig.state.generateDevice(username);

    (async () => {
        try {
            const user = await ig.account.login(username, password);

            const followersFeed = ig.feed.accountFollowers(user.pk);
            const followingFeed = ig.feed.accountFollowing(user.pk);
    
            const followers = await getAllItemsFromFeed(followersFeed);
    
            const following = await getAllItemsFromFeed(followingFeed);
    
            const users = new Set(followers.map(({ username }) => username));
    
            const nonFollowersList = following.filter(({ username }) => !users.has(username));
    
            let i = 0;
            
            for (const user of nonFollowersList) {
                i++;
    
                info[i] = i + ". " + user.username;
            }

            if (info.length == 0) {
                info[0] = 'Everyone follows you back, well done :)'
            } else {
                info = info.join(' ');
            }

            accountName = "(" + username + "'s unfollowers)";
            
            res.redirect('/');
        } catch (error) {
            const errorName = error.name;

            switch (errorName) {
                case 'IgLoginInvalidUserError':
                    info[0] = 'User not found. (Invalid user)';
                    break;
                case 'IgLoginBadPasswordError':
                    info[0] = 'Wrong password.';
                    break;
                default:
                    info[0] = error;
                    console.log(error);
                    break;
            }

            res.redirect('/');
        }
    })();
});

const getAllItemsFromFeed = async (feed) => {
    let items = [];
    do {
        items = items.concat(await feed.items());
    } while(feed.isMoreAvailable());
    return items;
}

app.listen(port);