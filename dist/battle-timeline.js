import {duration} from './battle-fx.js';
export function makeTimeline(events=[]){let time=0;const entries=[];for(const event of events){if(!['hit','heal','guard','friend','charge','phase','victory'].includes(event.type))continue;const seconds=event.type==='phase'?2:duration(event);entries.push({event,start:time,seconds,impact:time+seconds*(event.type==='hit'?.57:.45)});time+=seconds;}return {entries,seconds:Math.max(.25,time)};}
export function sampleTimeline(timeline,age){if(!Number.isFinite(age)||age<0)return null;return timeline.entries.find(e=>age>=e.start&&age<e.start+e.seconds)||null;}
