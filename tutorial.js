(function(){
  let cleanup=null;
  window.initSIDETutorial=function(onFinish){
    const root=document.querySelector('.tutorial-shell'),track=document.querySelector('#tutorialTrack'),slides=Array.from(document.querySelectorAll('.tutorial-slide')),prev=document.querySelector('#tutorialPrev'),next=document.querySelector('#tutorialNext'),dots=document.querySelector('#tutorialDots'),progress=document.querySelector('#tutorialProgressFill'),current=document.querySelector('#tutorialCurrent'),continueBtn=document.querySelector('#tutorialContinue');
    if(!root||!track||!slides.length)return;if(cleanup)cleanup();let index=0,timer=null,touchPaused=false;const AUTO_DELAY=5200;
    dots.innerHTML=slides.map((_,i)=>`<button type="button" class="tutorial-dot${i===0?' active':''}" aria-label="Ir a la diapositiva ${i+1}" data-slide="${i}"></button>`).join('');const dotButtons=Array.from(dots.querySelectorAll('.tutorial-dot'));
    function render(){track.style.transform=`translate3d(-${index*100}%,0,0)`;slides.forEach((s,i)=>s.classList.toggle('active',i===index));dotButtons.forEach((d,i)=>d.classList.toggle('active',i===index));if(current)current.textContent=String(index+1);if(progress)progress.style.width=`${((index+1)/slides.length)*100}%`;prev.disabled=index===0;next.disabled=index===slides.length-1;continueBtn.classList.toggle('hidden',index!==slides.length-1)}
    function stop(){if(timer!==null){clearTimeout(timer);timer=null}}
    function schedule(){stop();if(touchPaused||index>=slides.length-1)return;timer=setTimeout(()=>{index+=1;render();schedule()},AUTO_DELAY)}
    function go(value){index=Math.max(0,Math.min(slides.length-1,value));render();schedule()}
    function finish(){if(index!==slides.length-1)return;stop();root.classList.add('tutorial-leaving');setTimeout(()=>{root.classList.remove('tutorial-leaving');if(typeof onFinish==='function')onFinish()},260)}
    const onPrev=()=>go(index-1),onNext=()=>go(index+1),onContinue=()=>finish();prev.addEventListener('click',onPrev);next.addEventListener('click',onNext);continueBtn.addEventListener('click',onContinue);dotButtons.forEach(d=>d.addEventListener('click',()=>go(Number(d.dataset.slide))));
    const onKey=e=>{if(e.key==='ArrowLeft')onPrev();if(e.key==='ArrowRight')onNext()};document.addEventListener('keydown',onKey);let touchStartX=0;const onTouchStart=e=>{touchStartX=e.changedTouches[0].screenX;touchPaused=true;stop()},onTouchEnd=e=>{const diff=e.changedTouches[0].screenX-touchStartX;if(Math.abs(diff)>45)go(diff>0?index-1:index+1);touchPaused=false;schedule()};root.addEventListener('touchstart',onTouchStart,{passive:true});root.addEventListener('touchend',onTouchEnd,{passive:true});
    cleanup=()=>{stop();prev.removeEventListener('click',onPrev);next.removeEventListener('click',onNext);continueBtn.removeEventListener('click',onContinue);document.removeEventListener('keydown',onKey);root.removeEventListener('touchstart',onTouchStart);root.removeEventListener('touchend',onTouchEnd)};render();schedule();
  };
})();
