<template>
	<div>
    <div id="fillul" class="flexContainer"></div>
    <div id="filld" class="flexContainer"></div>
    <div id="fillur" class="flexContainer"></div>
    <div id="fillbar" class="flexContainer"></div>
    <div id="fillvoice" class="flexContainer"></div>
    <player-info id="pi1" playerIndex="0" height=45px></player-info>
    <player-info id="pi2" playerIndex="1" height=45px></player-info>
    <player-info id="pi3" playerIndex="2" height=45px></player-info>
		<test-game-container id="game"></test-game-container>
    <test-timer-container id="timer"></test-timer-container>
    <bingo-board id="Bingo-board" fontSize="30px"></bingo-board>
	</div>
</template>

<script lang="ts">
	import { Component, Vue, Watch, Prop } from "vue-property-decorator";
	import { nodecg, NodeCG } from "../../browser-util/nodecg";
	import { Bingoboard, BingosyncSocket, BingoboardMeta } from "../../../schemas";
	import { store, getReplicant } from "../../browser-util/state";
  import TestTimerContainer from "../components/timerContainer.vue";
	import TestGameContainer from "../components/gameContainer.vue";
  import BingoBoard from "../components/bingoboard.vue";
  import PlayerInfo from "../components/playerInfo.vue";
  import TeamInfo from "../components/teamInfo.vue";
  import PlayerTeamContainer from "../components/playerTeamContainer.vue";
  import { RunDataPlayer, RunDataTeam } from "../../../speedcontrol-types";

	@Component({
		components: {
			BingoBoard,
      TestGameContainer,
      PlayerInfo,
      TeamInfo,
      PlayerTeamContainer,
      TestTimerContainer,
		}
	})

	export default class GameLayout extends Vue {
    get teams(): RunDataTeam[] {
      return store.state.runDataActiveRun.teams;
    }
	}
</script>

<style scoped>
  #fillul {
    position: absolute;
    top: 0px;
    left: 0px;
    width: 889px;
    height: 500px;
    background-image: url("../../../static/middle-info-background.png");
    border: 2px var(--container-border-color) solid;
  }
  #filld {
    position: absolute;
    top: 500px;
    left: 516px;
    width: 960px;
    height: 500px;
    background-image: url("../../../static/middle-info-background.png");
    border: 2px var(--container-border-color) solid;
  }
  #fillur {
    position: absolute;
    top: 0px;
    left: 1031px;
    width: 889px;
    height: 500px;
    background-image: url("../../../static/middle-info-background.png");
    border: 2px var(--container-border-color) solid;
  }
  #fillbar {
    position: absolute;
    top: 1000px;
    left: 0px;
    width: 1920px;
    height: 80px;
    background-image: url("../../../static/middle-info-background.png");
    border: 2px var(--container-border-color) solid;
  }
  /*#fillvoice {
    position: absolute;
    top: 750px;
    left: 782px;
    width: 356px;
    height: 250px;
    background-image: url("../../../static/middle-info-background.png");
    border: 2px var(--container-border-color) solid;
  }*/
  #pi1 {
    position: absolute;
    top: 500px;
    left: 0px;
    border: 2px var(--container-border-color) solid;
    width: 501px;
  }
  #pi2 {
    position: absolute;
    top: 500px;
    left: 1404px;
    border: 2px var(--container-border-color) solid;
    width: 501px;
  }
  #pi3 {
    position: absolute;
    top: 940px;
    left: 0px;
    border: 2px var(--container-border-color) solid;
    width: 501px;
  }
  #Bingo-board {
    position: absolute;
    top: 560px;
    left: 1404px;
    border: 2px var(--container-border-color) solid;
    width: 516px;
    height: 440px;
  }
  #game {
    background-image: url("../../../static/middle-info-background.png");
    position: absolute;
    top: 0px;
    left: 889px;
    width: 142px;
    border: 2px var(--container-border-color) solid;
    height: 500px;
  }
  #timer{
    position: absolute;
    top: 560px;
    left: 0px;
    background-image: url("../../../static/middle-info-background.png");
    width: 516px;
    border: 2px var(--container-border-color) solid;
    height: 380px;
  }
</style>
