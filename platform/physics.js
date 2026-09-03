(function () {
  if (!window.Matter) {
    console.warn("Matter.js is not loaded, so Study Bro Stack physics is unavailable.");
    window.StudyBroPhysics = { available: false };
    return;
  }

  const {
    Bodies,
    Body,
    Composite,
    Engine,
    Events,
    Render,
    Runner
  } = window.Matter;

  function getStageSize(container) {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(320, Math.floor(rect.width)),
      height: Math.max(360, Math.floor(rect.height))
    };
  }

  function platformWidthFor(stageWidth) {
    return Math.min(300, Math.max(185, stageWidth * 0.36));
  }

  function createItemBody(item, x, y) {
    const airDampingByDifficulty = {
      easy: 0.018,
      medium: 0.015,
      hard: 0.011
    };
    const restitutionLimit = item.shape === "circle" ? 0.38 : 0.1;

    const options = {
      density: item.density,
      friction: Math.min(0.9, item.friction * 0.82),
      frictionStatic: Math.min(0.95, item.frictionStatic || item.friction * 0.9),
      frictionAir: item.frictionAir || airDampingByDifficulty[item.difficulty] || 0.014,
      restitution: Math.min(item.restitution, restitutionLimit),
      sleepThreshold: 75,
      label: `Study Bro Stack item: ${item.name}`,
      render: {
        fillStyle: item.color,
        strokeStyle: "#050505",
        lineWidth: 2
      }
    };

    const body = item.shape === "circle"
      ? Bodies.circle(x, y, item.radius, options)
      : Bodies.rectangle(x, y, item.width, item.height, {
        ...options,
        chamfer: item.chamfer ? { radius: item.chamfer } : undefined
      });

    if (item.dropAngle) {
      Body.setAngle(body, item.dropAngle);
    }

    body.studyBroStackItem = item;
    return body;
  }

  function createStackWorld({ container, onLose }) {
    const engine = Engine.create();
    const world = engine.world;
    const runner = Runner.create();
    const size = getStageSize(container);
    const placedBodies = [];
    let lost = false;
    let running = false;
    let platform = null;

    engine.enableSleeping = true;
    engine.positionIterations = 8;
    engine.velocityIterations = 6;
    engine.constraintIterations = 3;
    engine.gravity.x = 0;
    engine.gravity.y = 1;
    engine.gravity.scale = 0.0013;

    const render = Render.create({
      element: container,
      engine,
      options: {
        width: size.width,
        height: size.height,
        wireframes: false,
        background: "transparent",
        pixelRatio: window.devicePixelRatio || 1
      }
    });

    render.canvas.setAttribute("aria-hidden", "true");
    render.canvas.className = "study-bro-stack-canvas";

    function rebuildPlatform() {
      const { width, height } = getStageSize(container);
      const platformWidth = platformWidthFor(width);
      const nextPlatform = Bodies.rectangle(
        width / 2,
        height - 24,
        platformWidth,
        24,
        {
          isStatic: true,
          friction: 0.82,
          frictionStatic: 0.9,
          restitution: 0,
          label: "Study Bro Stack platform",
          render: {
            fillStyle: "#050505",
            strokeStyle: "#050505"
          }
        }
      );

      if (platform) {
        Composite.remove(world, platform);
      }

      platform = nextPlatform;
      Composite.add(world, platform);
    }

    function resize() {
      const { width, height } = getStageSize(container);
      const pixelRatio = window.devicePixelRatio || 1;

      render.options.width = width;
      render.options.height = height;
      render.canvas.width = width * pixelRatio;
      render.canvas.height = height * pixelRatio;
      render.canvas.style.width = "100%";
      render.canvas.style.height = "100%";
      render.bounds.min.x = 0;
      render.bounds.min.y = 0;
      render.bounds.max.x = width;
      render.bounds.max.y = height;

      rebuildPlatform();
    }

    function start() {
      resize();
      if (running) return;
      Render.run(render);
      Runner.run(runner, engine);
      running = true;
    }

    function stop() {
      if (!running) return;
      Render.stop(render);
      Runner.stop(runner);
      running = false;
    }

    function clearItems() {
      if (placedBodies.length) {
        Composite.remove(world, placedBodies.splice(0));
      }
      lost = false;
    }

    function dropItem(item, x, y) {
      const body = createItemBody(item, x, y);
      placedBodies.push(body);
      Composite.add(world, body);
      return body;
    }

    function checkForLoss() {
      if (lost || !placedBodies.length) return;

      const { width, height } = getStageSize(container);
      const fallenBody = placedBodies.find((body) => (
        body.position.y > height + 70 ||
        body.position.x < -150 ||
        body.position.x > width + 150
      ));

      if (!fallenBody) return;

      lost = true;
      if (typeof onLose === "function") {
        onLose(`${fallenBody.studyBroStackItem?.name || "An item"} fell off the stack.`);
      }
    }

    function destroy() {
      stop();
      window.removeEventListener("resize", resize);
      Composite.clear(world, false);
      Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    }

    Events.on(engine, "afterUpdate", checkForLoss);
    window.addEventListener("resize", resize);
    resize();

    return {
      engine,
      render,
      runner,
      start,
      stop,
      resize,
      clearItems,
      dropItem,
      destroy,
      getPlacedBodies: () => [...placedBodies]
    };
  }

  window.StudyBroPhysics = {
    available: true,
    createStackWorld
  };
}());
