<template>
    <v-app>
        <v-btn @click="clearAll">Clear All</v-btn>
        <div v-if="hostsSpeaking">Hosts are currently speaking, don't transition yet</div>
        <v-row>
            <v-col>
                <v-checkbox label="Switch to Intermission"/>
            </v-col>
            <v-col>
                <v-checkbox label="Play Next Run"/>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-checkbox label="Set Up Bingosync Room"/>
            </v-col>
            <v-col>
                <v-checkbox label="Set Up Player Colors"/>
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-checkbox label="Set the correct layout (for 4p runs ensure if the run is co-op or not)"/>
            </v-col>
            <v-col>
                <v-checkbox label="Check if all Twitch streams are loaded correctly and override them if necessary"/>
            </v-col>
        </v-row>
    </v-app>
</template>
<script lang="ts">

import {Component, Vue} from "vue-property-decorator"
import {store} from '../../browser-util/state'

@Component({})
export default class Checklist extends Vue {

    get hostsSpeaking() {
        return store.state.hostsSpeakingDuringIntermission.speaking
    }

    clearAll() {
        window.location.reload()
    }
}
</script>

<style>
body {
    padding: 1em;
}

.border {
    border: 2px solid black;
    border-radius: 5px;
    padding: 5px;
}

.row {
    display: flex;
}

.column {
    flex: 50%;
}

.multiselect {
    border: solid 1px #768948;
    overflow: auto;
}

.multiselect label {
    display: block;
}

.multiselect-on {
    color: #ffffff;
    background-color: #06BA63;
}

#reward {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #06BA63;
    color: white;
    pointer-events: none;
}

#reward.show {
    opacity: 1 !important;
}

</style>
