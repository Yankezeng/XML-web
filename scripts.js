// script.js
(() => {
            "use strict";

            const $ = (selector, scope = document) => scope.querySelector(selector);
            const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
            const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

            if (window.lucide) {
                window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
            }

            const showToast = (message) => {
                const toast = $(`[data-toast]`);
                if (!toast) return;
                $("span", toast).textContent = message;
                toast.classList.add("is-visible");
                clearTimeout(showToast.timer);
                showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
            };

            // Keep the future Agent UI decoupled from the site navigation.
            $$('[data-agent-entry]').forEach((entry) => {
                entry.addEventListener('click', () => {
                    window.dispatchEvent(new CustomEvent('knowledge-agent:open'));
                });
            });

            // Keep the demo counter stable for a session, then count a new visit once per tab.
            const viewCountEls = $$("[data-view-count]");
            let viewCount = Number(localStorage.getItem("ai-scope-view-count")) || 18245;
            if (!localStorage.getItem("ai-scope-view-count")) {
                localStorage.setItem("ai-scope-view-count", String(viewCount));
            }
            if (!sessionStorage.getItem("ai-scope-visited")) {
                viewCount += 1;
                localStorage.setItem("ai-scope-view-count", String(viewCount));
                sessionStorage.setItem("ai-scope-visited", "1");
            }
            const header = $(`[data-header]`);
            const backTop = $(`[data-back-top]`);
            const progress = $(".scroll-progress span");
            const updateScrollState = () => {
                const scrollY = window.scrollY;
                header?.classList.toggle("is-scrolled", scrollY > 25);
                backTop?.classList.toggle("is-visible", scrollY > 620);
                const max = document.documentElement.scrollHeight - window.innerHeight;
                if (progress) progress.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
            };
            updateScrollState();
            window.addEventListener("scroll", updateScrollState, { passive: true });

            const menuToggle = $(`[data-menu-toggle]`);
            const mainNav = $(`[data-main-nav]`);
            const navGroups = $$(`[data-nav-group]`);
            const closeNavGroups = () => {
                navGroups.forEach((group) => {
                    group.classList.remove("is-open");
                    $(".nav-parent", group)?.setAttribute("aria-expanded", "false");
                });
            };
            const closeMenu = () => {
                mainNav?.classList.remove("is-open");
                menuToggle?.setAttribute("aria-expanded", "false");
                document.body.classList.remove("is-menu-open");
                closeNavGroups();
                if (menuToggle) menuToggle.innerHTML = '<i data-lucide="menu"></i>';
                window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
            };
            menuToggle?.addEventListener("click", () => {
                const open = !mainNav.classList.contains("is-open");
                mainNav.classList.toggle("is-open", open);
                menuToggle.setAttribute("aria-expanded", String(open));
                document.body.classList.toggle("is-menu-open", open);
                menuToggle.innerHTML = `<i data-lucide="${open ? "x" : "menu"}"></i>`;
                window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
            });
            navGroups.forEach((group) => {
                const parent = $(".nav-parent", group);
                parent?.addEventListener("click", () => {
                    const isOpen = group.classList.contains("is-open");
                    navGroups.forEach((item) => {
                        item.classList.remove("is-open");
                        $(".nav-parent", item)?.setAttribute("aria-expanded", "false");
                    });
                    group.classList.toggle("is-open", !isOpen);
                    parent.setAttribute("aria-expanded", String(!isOpen));
                });
            });
            $$(".nav-link").forEach((link) => link.addEventListener("click", closeMenu));
            document.addEventListener("click", (event) => {
                if (!event.target.closest("[data-main-nav]")) closeNavGroups();
            });

            // Keep the active section visible in the navigation as the reader scrolls.
            const navLinks = $$(".nav-link");
            const sections = navLinks.map((link) => $(link.getAttribute("href"))).filter(Boolean);
            const sectionObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    navLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") ===
                        `#${entry.target.id}`));
                    navGroups.forEach((group) => {
                        const hasActive = Boolean($(".nav-link.is-active", group));
                        group.classList.toggle("has-active", hasActive);
                    });
                });
            }, { rootMargin: "-36% 0px -52%", threshold: 0 });
            sections.forEach((section) => sectionObserver.observe(section));

            const revealObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12 });
            $$(".reveal").forEach((el) => revealObserver.observe(el));

            // Small pointer tilt adds depth on desktop without changing the layout.
            if (!prefersReducedMotion && window.matchMedia("(pointer: fine)").matches) {
                $$(".tilt-card").forEach((card) => {
                    card.addEventListener("pointermove", (event) => {
                        const box = card.getBoundingClientRect();
                        const x = (event.clientX - box.left) / box.width - 0.5;
                        const y = (event.clientY - box.top) / box.height - 0.5;
                        card.style.transform =
                            `perspective(800px) rotateX(${y * -2.2}deg) rotateY(${x * 2.2}deg) translateY(-3px)`;
                    });
                    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
                });
            }

            const topicNotes = {
                "生成式 AI": { copy: "生成式 AI 学到的不是一串固定答案，而是内容背后的表达模式。你给它目标、语气和限制，它就能在这些边界内生成新内容。",
                    fact: "把它想象成一位读过一整座图书馆的即兴写作者：有灵感，但仍需要你做编辑。" },
                "机器学习": { copy: "机器学习会从带有例子的资料里调整参数，让预测结果越来越接近目标。垃圾邮件过滤、推荐列表和语音识别，都在使用这条思路。",
                    fact: "数据像练习题，模型像练习生；题目不够好，练习生也很难学得可靠。" },
                "多模态": { copy: "多模态模型可以把文字、图片、声音等信号放在一起理解。它不只是“看图说话”，还会把不同线索相互印证。",
                    fact: "同一件事提供更多线索，模型的视野会更宽，但偏差也可能被一起放大。" },
                "大语言模型": { copy: "大语言模型会把句子拆成一个个词元，再根据上下文预测下一个最合适的词元。它一次次预测，最终拼成完整回答。",
                    fact: "它更像一个非常强的语言接龙玩家：擅长组织表达，但不等于真的理解了世界。" },
                "提示词": { copy: "提示词是给模型的任务说明书。目标、背景、受众、输出格式和限制条件越明确，模型越容易沿着你想要的方向工作。",
                    fact: "好提示词的关键不是写得长，而是让任务边界、评价标准和交付格式都清楚。" },
                "AI 智能体": { copy: "AI 智能体不只回答问题，还可以把复杂目标拆成步骤，调用搜索、表格或代码等工具，并根据结果继续推进。",
                    fact: "智能体的能力来自‘规划 + 工具 + 检查’，每一步都应该留下可以复核的过程。" },
                "让一幅画，开口说话": { copy: "这个案例的重点不是让模型替艺术家发言，而是给观众一条更主动的观看路径：你可以追问细节、时代背景，甚至画中人的情绪。",
                    fact: "好的 AI 展览把模型放在幕后，把提问权留给观众。", context: "博物馆里一幅经典画作很美，却常常只停留在“看一眼、读说明牌”。策展团队希望让第一次来参观的人也能自然地提出问题，理解画面背后的时代和人物。",
                    process: "工作人员先整理画作的作者、年代、构图和可靠史料，再把这些资料交给多模态模型。观众对着画提问时，模型结合画面线索和馆方资料生成回答；遇到没有证据的内容，就提示“这是一种推测”。",
                    impact: "AI 负责把专业资料翻译成对话，人负责提出问题、判断回答，并保留对艺术作品的多种解释。它让参观从被动听讲变成主动探索。" },
                "给夜晚留一盏声音的灯": { copy: "语音模型降低了声音创作的门槛，让一个人的知识与表达可以被重新编排成陪伴型内容。",
                    fact: "当声音足够自然时，内容的来源与授权边界就更需要被清楚标注。",
                    context: "一位电台主持人想把“睡前逛博物馆”做成短音频，让没有时间出门的人，在夜晚也能听见一座城市的展览、街道和故事。",
                    process: "主持人先挑选展品和城市路线，再用语言模型整理资料、压缩成 15 分钟的叙事脚本。语音模型负责生成不同段落的试听版本，主持人逐段修改节奏、停顿和情绪，最后由真人审核事实并完成发布。",
                    impact: "AI 承担资料整理和多版本试音，人保留叙事温度、事实核对和声音授权。听众得到的是一段有陪伴感的内容，而不是一段没有来源的机器朗读。" },
                "和 1986 年的自己玩一局": { copy: "生成式模型在这里更像一个共同设计者：它补全的是玩法草图，真正决定游戏气质的仍是设计师的记忆与选择。",
                    fact: "共创的关键不是把决定交出去，而是把更多可能性带回桌面。",
                    context: "设计师翻出一台旧街机和一份未完成的关卡草图，想把童年记忆变成一款今天仍然好玩的小游戏，却不知道如何补上缺失的玩法。",
                    process: "他把像素画、关卡规则和童年玩耍的片段描述给生成式模型，让模型一次提出多种敌人、道具和关卡节奏。设计师逐个试玩、删改，再把可行的方案交回模型继续扩展，像和过去的自己来回打磨一局游戏。",
                    impact: "模型带来速度和意外的组合，设计师保留审美、取舍和最终署名。最有价值的不是机器替他完成作品，而是让记忆有机会长出新的形状。" },
            };
            const modal = $(`[data-modal]`);
            const openModal = (topic) => {
                const note = topicNotes[topic] || topicNotes["生成式 AI"];
                $("[data-modal-title]").textContent = topic;
                $("[data-modal-copy]").textContent = note.copy;
                $("[data-modal-fact]").textContent = note.fact;
                const caseDetails = $("[data-modal-case-details]", modal);
                const isCase = Boolean(note.context && note.process && note.impact);
                caseDetails.hidden = !isCase;
                if (isCase) {
                    $("[data-modal-context]", modal).textContent = note.context;
                    $("[data-modal-process]", modal).textContent = note.process;
                    $("[data-modal-impact]", modal).textContent = note.impact;
                }
                modal.classList.add("is-open");
                modal.setAttribute("aria-hidden", "false");
                document.body.classList.add("is-menu-open");
                $(".modal-close", modal)?.focus();
            };
            const closeModal = () => {
                modal.classList.remove("is-open");
                modal.setAttribute("aria-hidden", "true");
                document.body.classList.remove("is-menu-open");
            };
            $$("[data-open-modal], .topic-trigger, .case-detail").forEach((trigger) => {
                trigger.addEventListener("click", () => openModal(trigger.dataset.topic || "概念关系"));
            });
            $$(`[data-close-modal]`).forEach((trigger) => trigger.addEventListener("click", closeModal));
            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape" && modal.classList.contains("is-open")) closeModal();
            });

            const randomTopics = Object.keys(topicNotes).slice(0, 3);
            $(`[data-random-topic]`)?.addEventListener("click", () => {
                const topic = randomTopics[Math.floor(Math.random() * randomTopics.length)];
                openModal(topic);
            });

            // The knowledge section is a real carousel: desktop shows three concepts, mobile shows one.
            const knowledgeCarousel = $(`[data-knowledge-carousel]`);
            if (knowledgeCarousel) {
                const track = $(`[data-knowledge-track]`, knowledgeCarousel);
                const cards = $$(".knowledge-card", track);
                const current = $(`[data-knowledge-current]`, knowledgeCarousel);
                let active = 0;
                let timer;
                const perView = () => window.innerWidth <= 700 ? 1 : window.innerWidth <= 980 ? 2 : 3;
                const maxIndex = () => Math.max(0, cards.length - perView());
                const moveTo = (index) => {
                    active = Math.min(Math.max(index, 0), maxIndex());
                    const cardWidth = cards[0]?.getBoundingClientRect().width || 0;
                    const gap = Number.parseFloat(getComputedStyle(track).gap) || 0;
                    track.style.transform = `translateX(-${active * (cardWidth + gap)}px)`;
                    if (current) current.textContent = String(active + 1).padStart(2, "0");
                };
                const startTimer = () => { if (!prefersReducedMotion) timer = setInterval(() => moveTo(active >=
                        maxIndex() ? 0 : active + 1), 5200); };
                const resetTimer = () => { clearInterval(timer);
                    startTimer(); };
                $(`[data-knowledge-prev]`, knowledgeCarousel)?.addEventListener("click", () => { moveTo(active >=
                        maxIndex() ? 0 : active - 1);
                    resetTimer(); });
                $(`[data-knowledge-next]`, knowledgeCarousel)?.addEventListener("click", () => { moveTo(active >=
                        maxIndex() ? 0 : active + 1);
                    resetTimer(); });
                knowledgeCarousel.addEventListener("mouseenter", () => clearInterval(timer));
                knowledgeCarousel.addEventListener("mouseleave", startTimer);
                window.addEventListener("resize", () => moveTo(active));
                requestAnimationFrame(() => { moveTo(0);
                    startTimer(); });
            }

            $$(`[data-filter]`).forEach((button) => {
                button.addEventListener("click", () => {
                    const filter = button.dataset.filter;
                    $$("[data-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
                    let visible = 0;
                    $$("[data-category]", $(`[data-tool-grid]`)).forEach((card) => {
                        const matches = filter === "all" || card.dataset.category.split(" ").includes(filter);
                        card.hidden = !matches;
                        if (matches) visible += 1;
                    });
                    const count = $(`[data-tool-count]`);
                    if (count) count.textContent = String(visible).padStart(2, "0");
                });
            });

            const carousel = $(`[data-carousel]`);
            if (carousel) {
                const slides = $$(`[data-slide]`, carousel);
                const dots = $$(`[data-carousel-dot]`, carousel);
                const current = $(`[data-slide-current]`, carousel);
                let active = 0;
                let timer;
                const goTo = (index) => {
                    active = (index + slides.length) % slides.length;
                    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === active));
                    dots.forEach((dot, i) => { dot.classList.toggle("is-active", i === active);
                        dot.setAttribute("aria-selected", String(i === active)); });
                    if (current) current.textContent = String(active + 1).padStart(2, "0");
                };
                const startTimer = () => { if (!prefersReducedMotion) timer = setInterval(() => goTo(active + 1),
                        5600); };
                const resetTimer = () => { clearInterval(timer);
                    startTimer(); };
                $(`[data-carousel-prev]`, carousel)?.addEventListener("click", () => { goTo(active - 1);
                    resetTimer(); });
                $(`[data-carousel-next]`, carousel)?.addEventListener("click", () => { goTo(active + 1);
                    resetTimer(); });
                dots.forEach((dot) => dot.addEventListener("click", () => { goTo(Number(dot.dataset.carouselDot));
                    resetTimer(); }));
                carousel.addEventListener("mouseenter", () => clearInterval(timer));
                carousel.addEventListener("mouseleave", startTimer);
                startTimer();
            }

            const quizPanel = $("[data-quiz]");
            if (quizPanel) {
                const quizQuestions = [{
                    topic: "信息核查",
                    prompt: "AI 给出一个听起来很确定的答案，你会：",
                    options: [
                        { text: "直接转发，省下查证时间", score: 0,
                        feedback: "AI 的自信语气不等于事实确定，转发前先停一下。" },
                        { text: "先问依据，再找可靠来源核对", score: 2,
                        feedback: "很好！把 AI 当作线索，再用可靠来源完成核验。" },
                        { text: "只要答案顺耳，就当作一种可能", score: 1,
                        feedback: "保留怀疑是第一步，下一步还要检查证据是否存在。" },
                    ],
                }, {
                    topic: "标注与署名",
                    prompt: "你用 AI 生成了一张历史人物的插画，准备发到社交平台：",
                    options: [
                        { text: "标注 AI 生成，并补充必要的历史背景", score: 2,
                        feedback: "很稳！透明标注能帮助读者区分事实、创作与想象。" },
                        { text: "不说明来源，反正画面是自己挑的", score: 0,
                        feedback: "选择不标注会让别人误以为是史料或实拍，来源需要说清楚。" },
                        { text: "只在有人追问时再解释", score: 1,
                        feedback: "主动标注比被动解释更负责，也更尊重观看者。" },
                    ],
                }, {
                    topic: "个人隐私",
                    prompt: "你想让 AI 帮忙整理一份包含联系方式的文件，最好先：",
                    options: [
                        { text: "把完整文件上传，整理后再删除", score: 0,
                        feedback: "删除记录不代表风险消失，上传前就应该减少敏感信息。" },
                        { text: "先去除姓名、电话等敏感字段，再使用", score: 2,
                        feedback: "正确！先做脱敏和最小化处理，再让工具参与工作。" },
                        { text: "让 AI 先帮我找出哪些内容敏感", score: 1,
                        feedback: "可以先在本地识别，真正上传前仍要自己完成脱敏。" },
                    ],
                }, {
                    topic: "学习与创作",
                    prompt: "面对一份课程作业，比较合适的 AI 用法是：",
                    options: [
                        { text: "让 AI 写完全文，改几个词就提交", score: 0,
                        feedback: "直接提交代写内容会失去学习过程，也可能违反课程规则。" },
                        { text: "让 AI 完成答案，自己快速通读一遍", score: 1,
                        feedback: "通读还不够，应该确认观点、证据和表达都真正属于自己。" },
                        { text: "用 AI 头脑风暴，再独立写作并标注帮助", score: 2,
                        feedback: "很好！让 AI 提供启发，把理解、判断和表达留在自己手里。" },
                    ],
                }, {
                    topic: "推荐与选择",
                    prompt: "你发现推荐算法总在推同一类内容，接下来会：",
                    options: [
                        { text: "主动搜索不同来源，偶尔重置自己的信息流", score: 2,
                        feedback: "很好的做法！主动增加异质信息，能减少信息茧房。" },
                        { text: "照单全收，平台推荐的一定更适合我", score: 0,
                        feedback: "推荐是预测，不是命令；它可能放大偏好，也可能遗漏重要声音。" },
                        { text: "先看一段时间，再决定是否调整", score: 1,
                        feedback: "观察有帮助，但也可以现在就加入不同观点作为对照。" },
                    ],
                }, {
                    topic: "深度伪造",
                    prompt: "你收到熟人的语音消息，对方急着让你转账，你会：",
                    options: [
                        { text: "马上转账，声音听起来就是本人", score: 0,
                        feedback: "声音也可能被仿造，紧急转账一定要通过另一渠道确认。" },
                        { text: "先打原来的电话或当面确认，再决定", score: 2,
                        feedback: "正确！换一个可信渠道核验，是应对深度伪造的关键动作。" },
                        { text: "让对方再发一条语音证明身份", score: 1,
                        feedback: "追加语音仍可能被仿造，最好改用原号码回拨或当面确认。" },
                    ],
                }, {
                    topic: "引用核验",
                    prompt: "AI 回答里出现了几条看似专业的引用，你会：",
                    options: [
                        { text: "看到有链接就相信，不再打开", score: 0,
                        feedback: "链接外观不能证明内容真实，引用需要点击并核对上下文。" },
                        { text: "只看标题和摘要，感觉相关就算通过", score: 1,
                        feedback: "标题可能被误读，至少要确认原文确实支持这句话。" },
                        { text: "打开原文，核对作者、时间和支持的具体观点", score: 2,
                        feedback: "很棒！来源、时间与原文语境，都是判断引用质量的线索。" },
                    ],
                }, {
                    topic: "提示词隐私",
                    prompt: "写提示词时想引用一段私人聊天记录，你会：",
                    options: [
                        { text: "先用代称和摘要替换真实姓名、账号与细节", score: 2,
                        feedback: "正确！用最少必要信息表达问题，能同时保留上下文和隐私。" },
                        { text: "把完整聊天记录贴进去，效率最高", score: 0,
                        feedback: "完整记录往往包含无关的隐私，效率不该建立在过度暴露之上。" },
                        { text: "先完整分享，处理完后再删除对话", score: 1,
                        feedback: "事后删除不如事前脱敏，先替换敏感信息会更稳妥。" },
                    ],
                }, {
                    topic: "矛盾答案",
                    prompt: "两个 AI 对同一个事实给出矛盾答案，你会：",
                    options: [
                        { text: "选择语气更自信的那个", score: 0,
                        feedback: "语气只是表达风格，不是证据；冲突时要回到可核查的来源。" },
                        { text: "停止使用 AI，完全不再考虑这个问题", score: 1,
                        feedback: "暂停是谨慎的开始，但还可以继续查找权威资料来解决分歧。" },
                        { text: "比较来源和依据，必要时查阅权威资料", score: 2,
                        feedback: "很好！把分歧当作核查信号，而不是让模型替你投票。" },
                    ],
                }, {
                    topic: "高风险决策",
                    prompt: "遇到医疗、法律等重要问题，AI 给了一个具体建议，你会：",
                    options: [
                        { text: "先按建议执行，出了问题再说", score: 0,
                        feedback: "高风险决定不能只靠 AI，错误成本太高，需要专业人士参与。" },
                        { text: "再问另一个 AI，两个答案一致就执行", score: 1,
                        feedback: "多个模型一致也不等于正确，应该把 AI 当作准备问题的辅助工具。" },
                        { text: "把 AI 当作信息起点，再咨询合格的专业人士", score: 2,
                        feedback: "这是成熟的边界：AI 帮你准备，专业人士负责关键判断。" },
                    ],
                }, ];

                const state = { current: 0, score: 0, answered: false, selectedScore: 0 };
                const currentEl = $("[data-quiz-current]", quizPanel);
                const totalEl = $("[data-quiz-total]", quizPanel);
                const scoreEl = $("[data-quiz-score]", quizPanel);
                const topicEl = $("[data-quiz-topic]", quizPanel);
                const questionEl = $("[data-quiz-question]", quizPanel);
                const optionsEl = $("[data-quiz-options]", quizPanel);
                const feedbackEl = $("[data-quiz-feedback]", quizPanel);
                const progressEl = $("[data-quiz-progress]", quizPanel);
                const nextButton = $("[data-quiz-next]", quizPanel);
                const quizMain = $("[data-quiz-main]", quizPanel);
                const report = $("[data-quiz-report]", quizPanel);

                const renderQuestion = () => {
                    const question = quizQuestions[state.current];
                    state.answered = false;
                    state.selectedScore = 0;
                    currentEl.textContent = String(state.current + 1).padStart(2, "0");
                    totalEl.textContent = String(quizQuestions.length).padStart(2, "0");
                    scoreEl.textContent = "已得分 " + String(state.score).padStart(2, "0") + " / 20";
                    topicEl.textContent = question.topic;
                    questionEl.textContent = question.prompt;
                    optionsEl.innerHTML = question.options.map((option, index) =>
                        "<button type=\"button\" aria-pressed=\"false\" data-answer-index=\"" + index +
                        "\"><span class=\"option-key\">" + String.fromCharCode(65 + index) +
                        "</span><span>" + option.text + "</span><i data-lucide=\"arrow-up-right\"></i></button>"
                        ).join("");
                    feedbackEl.textContent = "选择一个最接近你的反应，看看会得到什么提示。";
                    nextButton.disabled = true;
                    nextButton.innerHTML = "选择后继续 <i data-lucide=\"arrow-right\"></i>";
                    progressEl.style.width = ((state.current + 1) / quizQuestions.length) * 100 + "%";
                    progressEl.parentElement.setAttribute("aria-valuenow", String(state.current + 1));
                    window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
                };

                const renderReport = () => {
                    const score = state.score;
                    let level;
                    let summary;
                    let strengths;
                    let advice;
                    if (score >= 17) {
                        level = "边界感很稳";
                        summary = "你会把 AI 当作助手，而不是最终裁判：先核查、再判断，也知道什么时候把决定交给专业人士。";
                        strengths = ["会主动核对来源与引用", "能识别隐私和深度伪造风险", "愿意为最终判断保留责任"];
                        advice = ["把核验步骤分享给身边的人", "继续关注模型和平台的使用边界", "面对新工具时保持同样的谨慎"];
                    } else if (score >= 13) {
                        level = "正在建立边界";
                        summary = "你已经有不错的风险直觉，但在忙碌或信息很像真的时候，仍可能少走一步核查。";
                        strengths = ["知道 AI 可能出错", "愿意在关键时刻停下来", "已经掌握一些基本核验方法"];
                        advice = ["给转发和转账设置一个冷静期", "把来源、隐私、风险三步变成习惯", "高风险问题优先找权威或专业来源"];
                    } else {
                        level = "需要加强核查意识";
                        summary = "你对 AI 保持好奇是很好的起点；接下来要练习在相信和行动之间，加入一个可复核的步骤。";
                        strengths = ["愿意主动了解 AI 的能力", "能发现自己还不确定的地方", "有机会通过练习快速进步"];
                        advice = ["先记住：自信语气不等于事实", "涉及隐私、金钱和健康时先暂停", "从核对一个来源开始建立习惯"];
                    }
                    $("[data-report-score]", report).textContent = String(score).padStart(2, "0");
                    $("[data-report-level]", report).textContent = level;
                    $("[data-report-summary]", report).textContent = summary;
                    $("[data-report-strengths]", report).innerHTML = strengths.map((item) => "<li>" + item +
                        "</li>").join("");
                    $("[data-report-advice]", report).innerHTML = advice.map((item) => "<li>" + item + "</li>")
                    .join("");
                    quizMain.hidden = true;
                    report.hidden = false;
                    progressEl.style.width = "100%";
                    progressEl.parentElement.setAttribute("aria-valuenow", String(quizQuestions.length));
                    window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
                };

                optionsEl.addEventListener("click", (event) => {
                    const button = event.target.closest("[data-answer-index]");
                    if (!button) return;
                    const answerIndex = Number(button.dataset.answerIndex);
                    const option = quizQuestions[state.current].options[answerIndex];
                    const isChangingAnswer = state.answered;
                    state.answered = true;
                    state.score = state.score - state.selectedScore + option.score;
                    state.selectedScore = option.score;
                    $$("[data-answer-index]", optionsEl).forEach((item) => {
                        item.classList.toggle("is-selected", item === button);
                        item.setAttribute("aria-pressed", String(item === button));
                    });
                    feedbackEl.textContent = option.feedback;
                    scoreEl.textContent = "已得分 " + String(state.score).padStart(2, "0") + " / 20";
                    progressEl.style.width = ((state.current + 1) / quizQuestions.length) * 100 + "%";
                    progressEl.parentElement.setAttribute("aria-valuenow", String(state.current + 1));
                    nextButton.disabled = false;
                    nextButton.innerHTML = (state.current === quizQuestions.length - 1 ? "查看反馈报告" :
                        "下一题") + " <i data-lucide=\"arrow-right\"></i>";
                    window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
                    showToast(isChangingAnswer ? "答案已更新" : option.score === 2 ? "边界判断 +2，继续保持" :
                        option.score === 1 ? "收到，这里还有一步可以更稳" : "记住先暂停，再核查");
                });

                nextButton.addEventListener("click", () => {
                    if (!state.answered) return;
                    if (state.current === quizQuestions.length - 1) {
                        renderReport();
                        return;
                    }
                    state.current += 1;
                    renderQuestion();
                });

                $("[data-quiz-restart]", quizPanel)?.addEventListener("click", () => {
                    state.current = 0;
                    state.score = 0;
                    report.hidden = true;
                    quizMain.hidden = false;
                    renderQuestion();
                    questionEl.focus?.();
                    showToast("新的测试开始了");
                });

                renderQuestion();
            }

            backTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ?
                    "auto" : "smooth" }));
        })();
// === Number-flip counter and AI history timeline ===
(() => {
    'use strict';
    const query = (selector, scope = document) => scope.querySelector(selector);
    const queryAll = (selector, scope = document) => [...scope.querySelectorAll(selector)];
    const counterTargets = queryAll('[data-view-count]');
    const count = Number(localStorage.getItem('ai-scope-view-count')) || 18246;
    const Flip = window.NumberFlip && window.NumberFlip.Flip;
    if (counterTargets.length) {
        if (Flip) {
            counterTargets.forEach((node) => {
                node.replaceChildren();
                new Flip({ node, from: Math.max(0, count - 125), to: count, duration: 1.15, separator: ',' });
            });
        } else {
            counterTargets.forEach((node) => { node.textContent = count.toLocaleString('en-US'); });
        }
    }
    const viewport = query('[data-timeline-viewport]');
    const track = query('[data-timeline-track]');
    if (!viewport || !track) return;
    const nodes = queryAll('[data-timeline-node]', track);
    const current = query('[data-timeline-current]');
    const historyImages = {
        '1943': 'Figure/history-neurons.svg',
        '1950': 'Figure/history-turing.svg',
        '1956': 'Figure/history-dartmouth.svg',
        '1966': 'Figure/history-eliza.svg',
        '1986': 'Figure/history-backprop.svg',
        '1997': 'Figure/history-deepblue.svg',
        '2012': 'Figure/history-alexnet.svg',
        '2017': 'Figure/history-transformer.svg',
        '2022': 'Figure/history-chatgpt.svg',
        '2024': 'Figure/history-agents.svg'
    };
    nodes.forEach((node) => {
        const card = query('.timeline-card', node);
        const year = node.dataset.year;
        if (!card || !historyImages[year] || query('.timeline-visual', card)) return;
        const visual = document.createElement('div');
        visual.className = 'timeline-visual';
        const image = document.createElement('img');
        image.src = historyImages[year];
        image.alt = `${year} 年人工智能发展节点示意图`;
        image.loading = 'lazy';
        visual.append(image);
        card.prepend(visual);
    });
    const setActive = (node) => {
        nodes.forEach((item) => item.classList.toggle('is-hovered', item === node));
        if (current && node) current.textContent = node.dataset.year;
    };
    const clearActive = () => nodes.forEach((item) => item.classList.remove('is-hovered'));
    clearActive();
    nodes.forEach((node) => {
        node.addEventListener('mouseenter', () => setActive(node));
        node.addEventListener('focusin', () => setActive(node));
        node.addEventListener('mouseleave', clearActive);
        node.addEventListener('focusout', (event) => {
            if (!node.contains(event.relatedTarget)) clearActive();
        });
    });
    const timelineSection = viewport.closest('.timeline-section') || viewport;
    const header = query('[data-header]');
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    let timelineMetrics = { lockTop: 0, maxScroll: 0, scrollDistance: 0 };
    let timelineFrame = 0;

    const syncTimelineMetrics = () => {
        const headerHeight = header?.getBoundingClientRect().height || 0;
        const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const scrollDistance = Math.max(maxScroll, window.innerHeight * 0.9);
        const lockTop = Math.max(0, Math.round(timelineSection.getBoundingClientRect().top + window.scrollY - headerHeight));
        timelineSection.style.setProperty('--timeline-lock-top', headerHeight + 'px');
        timelineSection.style.setProperty('--timeline-scroll-distance', Math.round(scrollDistance) + 'px');
        timelineMetrics = { lockTop, maxScroll, scrollDistance };
    };

    const syncTimelineCurrent = () => {
        if (!current || !nodes.length) return;
        const viewportBox = viewport.getBoundingClientRect();
        const centerX = viewportBox.left + viewportBox.width * 0.58;
        const activeNode = nodes.reduce((closest, node) => {
            const nodeBox = node.getBoundingClientRect();
            const distance = Math.abs(nodeBox.left + nodeBox.width / 2 - centerX);
            return distance < closest.distance ? { node, distance } : closest;
        }, { node: nodes[0], distance: Infinity }).node;
        if (activeNode) current.textContent = activeNode.dataset.year;
    };

    const updateTimelineFromPageScroll = () => {
        timelineFrame = 0;
        if (!timelineMetrics.maxScroll) {
            syncTimelineMetrics();
            if (!timelineMetrics.maxScroll) return;
        }
        const progress = clamp((window.scrollY - timelineMetrics.lockTop) / timelineMetrics.scrollDistance, 0, 1);
        viewport.scrollLeft = timelineMetrics.maxScroll * progress;
        syncTimelineCurrent();
    };

    const requestTimelineUpdate = () => {
        if (timelineFrame) return;
        timelineFrame = window.requestAnimationFrame(updateTimelineFromPageScroll);
    };

    syncTimelineMetrics();
    requestTimelineUpdate();
    window.addEventListener('scroll', requestTimelineUpdate, { passive: true });
    viewport.addEventListener('scroll', syncTimelineCurrent, { passive: true });
    window.addEventListener('resize', () => {
        syncTimelineMetrics();
        requestTimelineUpdate();
    }, { passive: true });
    viewport.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') { event.preventDefault(); viewport.scrollLeft += viewport.clientWidth * 0.72; }
        if (event.key === 'ArrowLeft') { event.preventDefault(); viewport.scrollLeft -= viewport.clientWidth * 0.72; }
    });

    const distortionLogo = query('[data-mosaic-logo]');
    const distortionCanvas = query('[data-grid-distortion]');
    if (distortionLogo && distortionCanvas) {
        const context = distortionCanvas.getContext('2d');
        const sourceCanvas = document.createElement('canvas');
        const sourceContext = sourceCanvas.getContext('2d');
        const pointer = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };
        const gridSize = 14;
        const mouseRadius = 180;
        const strength = 0.34;
        const relaxation = 0.12;
        let logicalWidth = 0;
        let logicalHeight = 0;
        let pixelRatio = 1;

        const resizeDistortion = () => {
            const bounds = distortionCanvas.getBoundingClientRect();
            logicalWidth = Math.max(1, bounds.width);
            logicalHeight = Math.max(1, bounds.height);
            pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            distortionCanvas.width = Math.round(logicalWidth * pixelRatio);
            distortionCanvas.height = Math.round(logicalHeight * pixelRatio);
            sourceCanvas.width = distortionCanvas.width;
            sourceCanvas.height = distortionCanvas.height;
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            sourceContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            sourceContext.clearRect(0, 0, logicalWidth, logicalHeight);
            const size = Math.min(190, Math.max(52, logicalWidth * .125));
            sourceContext.fillStyle = '#c9d8c5';
            sourceContext.font = `900 ${size}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
            sourceContext.textAlign = 'center';
            sourceContext.textBaseline = 'middle';
            sourceContext.fillText('AI 通识局', logicalWidth / 2, logicalHeight / 2 + size * .03);
        };

        const drawDistortion = () => {
            pointer.x += (pointer.targetX - pointer.x) * relaxation;
            pointer.y += (pointer.targetY - pointer.y) * relaxation;
            context.clearRect(0, 0, logicalWidth, logicalHeight);
            const columns = Math.ceil(logicalWidth / gridSize);
            const rows = Math.ceil(logicalHeight / gridSize);
            for (let row = 0; row < rows; row += 1) {
                for (let column = 0; column < columns; column += 1) {
                    const sx = column * gridSize;
                    const sy = row * gridSize;
                    const sw = Math.min(gridSize + 1, logicalWidth - sx);
                    const sh = Math.min(gridSize + 1, logicalHeight - sy);
                    const centerX = sx + sw / 2;
                    const centerY = sy + sh / 2;
                    const distance = Math.hypot(centerX - pointer.x, centerY - pointer.y);
                    const influence = Math.max(0, 1 - distance / mouseRadius);
                    const force = influence * influence * strength * mouseRadius;
                    const angle = Math.atan2(centerY - pointer.y, centerX - pointer.x);
                    const dx = Math.cos(angle) * force;
                    const dy = Math.sin(angle) * force;
                    context.drawImage(sourceCanvas, sx * pixelRatio, sy * pixelRatio, sw * pixelRatio, sh * pixelRatio, sx + dx, sy + dy, sw, sh);
                }
            }
            window.requestAnimationFrame(drawDistortion);
        };

        const updatePointer = (event) => {
            const bounds = distortionCanvas.getBoundingClientRect();
            pointer.targetX = event ? event.clientX - bounds.left : logicalWidth / 2;
            pointer.targetY = event ? event.clientY - bounds.top : logicalHeight / 2;
            distortionLogo.classList.add('is-distorting');
        };
        const resetPointer = () => {
            pointer.targetX = -1000;
            pointer.targetY = -1000;
            distortionLogo.classList.remove('is-distorting');
        };
        resizeDistortion();
        window.addEventListener('resize', resizeDistortion, { passive: true });
        distortionLogo.addEventListener('pointerenter', updatePointer);
        distortionLogo.addEventListener('pointermove', updatePointer);
        distortionLogo.addEventListener('focus', () => updatePointer());
        distortionLogo.addEventListener('pointerleave', resetPointer);
        distortionLogo.addEventListener('blur', resetPointer);
        drawDistortion();
    }
    if (current && nodes[0]) current.textContent = nodes[0].dataset.year;
    window.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
})();

// === Knowledge Agent chat UI (falls back to mock streaming without an API URL) ===
(() => {
    'use strict';

    const panel = document.querySelector('[data-agent-panel]');
    const entry = document.querySelector('[data-agent-entry]');
    const closeButton = document.querySelector('[data-agent-close]');
    const messageList = document.querySelector('[data-agent-messages]');
    const form = document.querySelector('[data-agent-form]');
    const input = document.querySelector('[data-agent-input]');
    const sendButton = document.querySelector('[data-agent-send]');
    const suggestions = document.querySelector('[data-agent-suggestions]');
    if (!panel || !entry || !messageList || !form || !input || !sendButton) return;

    let busy = false;
    let streamController = null;
    const chatHistory = [];
    const apiUrl = window.KNOWLEDGE_AGENT_API_URL || '';
    const sessionKey = 'knowledge-agent-session';
    const sessionId = sessionStorage.getItem(sessionKey) || (window.crypto?.randomUUID?.() || `web-${Date.now()}`);
    sessionStorage.setItem(sessionKey, sessionId);

    const scrollToLatest = () => {
        messageList.scrollTop = messageList.scrollHeight;
    };

    const setOpen = (open) => {
        panel.classList.toggle('is-open', open);
        entry.classList.toggle('is-panel-open', open);
        panel.setAttribute('aria-hidden', String(!open));
        entry.setAttribute('aria-expanded', String(open));
        if (open) {
            window.setTimeout(() => input.focus(), 180);
            scrollToLatest();
        }
    };

    const autoResizeInput = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 108) + 'px';
    };

    const createIcon = (name) => {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', name);
        return icon;
    };

    const appendUserMessage = (text) => {
        const article = document.createElement('article');
        article.className = 'agent-message agent-message-user';
        const body = document.createElement('div');
        body.className = 'agent-message-body';
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        body.append(paragraph);
        article.append(body);
        messageList.append(article);
        scrollToLatest();
    };

    const appendAssistantShell = () => {
        const article = document.createElement('article');
        article.className = 'agent-message agent-message-assistant';

        const avatar = document.createElement('span');
        avatar.className = 'agent-message-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.append(createIcon('sparkles'));

        const body = document.createElement('div');
        body.className = 'agent-message-body';

        const thinking = document.createElement('details');
        thinking.className = 'agent-thinking';
        thinking.open = true;
        const summary = document.createElement('summary');
        summary.append(createIcon('brain-circuit'), document.createTextNode(' 我正在为你梳理'));
        const thinkingOutput = document.createElement('pre');
        thinkingOutput.className = 'agent-thinking-output agent-caret';
        thinking.append(summary, thinkingOutput);

        const answer = document.createElement('p');
        answer.className = 'agent-answer-output';
        answer.hidden = true;

        const sources = document.createElement('div');
        sources.className = 'agent-sources';
        sources.hidden = true;

        body.append(thinking, answer, sources);
        article.append(avatar, body);
        messageList.append(article);
        window.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
        scrollToLatest();
        return { thinking, thinkingOutput, answer, sources };
    };

    const wait = (milliseconds, signal) => new Promise((resolve, reject) => {
        const timer = window.setTimeout(resolve, milliseconds);
        signal?.addEventListener('abort', () => {
            window.clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });

    const streamText = async (element, text, signal, speed = 22) => {
        for (const character of text) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            element.textContent += character;
            scrollToLatest();
            await wait(speed, signal);
        }
    };

    const buildMockResponse = (question) => {
        const normalized = question.toLowerCase();
        if (normalized.includes('rerank') || question.includes('重排')) {
            return {
                reasoning: '我先看看资料里怎样解释“重排”，再把它和前面的召回步骤放在一起说，免得只记住一个术语。',
                answer: 'Rerank 用于修正向量检索“召回广但排序不够精确”的问题。系统会先让 Milvus 召回约 30 个候选片段，再用 BAAI/bge-reranker-v2-m3 对“问题—片段”逐对评分，最终保留相关性最高的 3～5 个片段交给 DeepSeek。这样能明显减少语义相近但实际答非所问的内容。',
                sources: ['系统架构设计 / RAG 二阶段检索', '模型配置 / BAAI/bge-reranker-v2-m3']
            };
        }
        if (normalized.includes('milvus')) {
            return {
                reasoning: '我去资料里确认各个组件分别做什么，重点把 Milvus 和重排模型的边界说清楚。',
                answer: 'Milvus 是系统的向量数据库，负责保存知识片段的 1024 维向量、原文和元数据，并根据用户问题的向量执行相似度搜索。Attu 只是 Milvus 的管理界面，用来查看 Collection、索引和数据状态，不直接参与用户问答。',
                sources: ['系统架构设计 / Milvus Collection', '运维设计 / Attu 管理职责']
            };
        }
        return {
            reasoning: '我先找和这个问题最贴近的资料，再把关键概念换成更容易理解的说法。',
            answer: '本项目的 RAG 流程是：问题改写 → BGE Embedding → Milvus 召回 Top 30 → BGE Reranker 重排 → 保留 Top 5 → LangChain Agent 调用 DeepSeek 生成带引用的回答。若检索结果不足，Agent 会明确提示知识库中没有足够信息，而不是编造答案。',
            sources: ['系统架构设计 / RAG Pipeline', '检索策略 / Top-K 与重排规则']
        };
    };

    const renderSources = (container, items) => {
        container.replaceChildren();
        const label = document.createElement('span');
        label.textContent = 'REFERENCES / 我查到的资料';
        container.append(label);
        items.forEach((item) => {
            const source = document.createElement('div');
            source.className = 'agent-source-item';
            source.append(createIcon('file-text'), document.createTextNode(item));
            container.append(source);
        });
        container.hidden = false;
        window.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
    };

    const streamRealResponse = async (question, ui, signal) => {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            body: JSON.stringify({
                session_id: sessionId,
                message: question,
                history: chatHistory.slice(-20)
            }),
            signal
        });
        if (!response.ok || !response.body) throw new Error('知识库服务暂时不可用');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { value, done } = await reader.read();
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() || '';
            for (const block of blocks) {
                const eventLine = block.split(/\r?\n/).find((line) => line.startsWith('event:')) || '';
                const dataLine = block.split(/\r?\n/).find((line) => line.startsWith('data:')) || '';
                if (!dataLine) continue;
                let data;
                try { data = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
                const type = eventLine.slice(6).trim();
                if (type === 'reasoning') {
                    ui.thinkingOutput.textContent += data.text || '';
                    scrollToLatest();
                } else if (type === 'token') {
                    ui.answer.hidden = false;
                    ui.answer.classList.add('agent-caret');
                    ui.answer.textContent += data.text || '';
                    scrollToLatest();
                } else if (type === 'source') {
                    ui.sources.hidden = false;
                    const source = document.createElement('div');
                    source.className = 'agent-source-item';
                    source.append(createIcon('file-text'), document.createTextNode(`${data.title || data.source || '知识库片段'}${data.page ? ` · 第 ${data.page} 页` : ''}`));
                    if (!ui.sources.querySelector('span')) {
                        const label = document.createElement('span');
                        label.textContent = 'REFERENCES / 我查到的资料';
                        ui.sources.append(label);
                    }
                    ui.sources.append(source);
                    window.lucide?.createIcons({ attrs: { 'stroke-width': 1.8 } });
                } else if (type === 'error') {
                    throw new Error(data.message || '服务返回错误');
                }
            }
            if (done) break;
        }
    };

    const submitQuestion = async (rawQuestion) => {
        const question = rawQuestion.trim();
        if (!question || busy) return;
        busy = true;
        sendButton.disabled = true;
        suggestions?.remove();
        appendUserMessage(question);
        input.value = '';
        autoResizeInput();

        const ui = appendAssistantShell();
        const mock = buildMockResponse(question);
        streamController = new AbortController();

        try {
            if (apiUrl) {
                ui.thinkingOutput.classList.add('agent-caret');
                await streamRealResponse(question, ui, streamController.signal);
                ui.thinkingOutput.classList.remove('agent-caret');
                ui.answer.classList.remove('agent-caret');
            } else {
                await streamText(ui.thinkingOutput, mock.reasoning, streamController.signal, 17);
                ui.thinkingOutput.classList.remove('agent-caret');
                ui.answer.hidden = false;
                ui.answer.classList.add('agent-caret');
                await streamText(ui.answer, mock.answer, streamController.signal, 21);
                ui.answer.classList.remove('agent-caret');
                renderSources(ui.sources, mock.sources);
            }
            chatHistory.push({ role: 'user', content: question });
            chatHistory.push({ role: 'assistant', content: ui.answer.textContent, reasoning_content: ui.thinkingOutput.textContent });
            if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20);
        } catch (error) {
            if (error.name !== 'AbortError') {
                ui.thinkingOutput.classList.remove('agent-caret');
                ui.answer.classList.remove('agent-caret');
                ui.answer.hidden = false;
                ui.answer.textContent = error.message || '回复生成失败，请稍后重试。';
            }
        } finally {
            busy = false;
            sendButton.disabled = false;
            streamController = null;
            input.focus();
            scrollToLatest();
        }
    };

    window.addEventListener('knowledge-agent:open', () => setOpen(true));
    closeButton?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false);
    });
    input.addEventListener('input', autoResizeInput);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submitQuestion(input.value);
    });
    document.querySelectorAll('[data-agent-suggestion]').forEach((button) => {
        button.addEventListener('click', () => submitQuestion(button.dataset.agentSuggestion || button.textContent));
    });
})();
