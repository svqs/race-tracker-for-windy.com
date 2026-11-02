import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-racetrack',
    version: '1.2.5',
    icon: '⛵',
    // the name in Windy's list of plugins (Windy needs more than 7 characters)
    title: 'Race Tracker',
    description: 'Follow Milan Koláček live on the Windy map during the Route du Rhum 2026: his track, speed, the distance to the finish and the wind where he is.',
    author: 'Sophia Stoltz',
    repository: 'https://github.com/svqs/Race-Tracker-for-Windy.com',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    desktopWidth: 400,
    routerPath: '/racetrack',
    // public: Windy's team sees it in the plugin publisher and can review it for the gallery
    private: false,
};

export default config;
