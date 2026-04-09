# GuessIt - Football Prediction App

## Overview
GuessIt is a modern football prediction app that lets users predict match outcomes and track their prediction accuracy.

## Main Page Layout (Updated)
Matches are **grouped by league** with league section headers:

- **League Header**: [League Logo] League Name / Country Name → ">" arrow (navigate to league matches)
- **No filter tabs** (removed: Top Matches, Popular, Top Live, Soon, Ended, Favorite)
- **No league pills** (removed: All Matches, Live, UCL, etc.)
- **Bell icon** (replaces bookmark) for match notifications

## Match Card Design (Updated)
The main page uses a clean, compact card layout matching the designer's reference:

- **Top Row**: `Fri,10Apr` (date) | `20:45` (time) | `Starts in 3h` (countdown) + bell icon — separated from content by a thin line
- **Teams Row**: [Large Crest] TEAM NAME (bold, uppercase) | **VS** | TEAM NAME [Large Crest]
- **Prediction Bars**: Three bars **side by side** (3 columns) — bar on top, green label below: `1: 45%` | `X: 30%` | `2: 25%`
- **PREDICT MATCH Button**: Full width, dark green background, green border, pill-shaped — opens Advanced Options modal (Exact Score, Smart Advice, Invite Friend, Friends Activity)
- **No league name** displayed on the card

## Banner Section
Horizontal scrollable carousel of image-based highlight cards:
- Portrait orientation (3:4 aspect ratio)
- Full image backgrounds with football action shots
- Score overlay with team crests and scorer details
- Snap scrolling, no auto-slide

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Craco, Radix UI
- **Backend**: FastAPI, Motor (MongoDB), Redis
- **APIs**: football-data.org v4, Stripe

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
