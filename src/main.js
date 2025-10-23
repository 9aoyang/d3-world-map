// 等待所有脚本加载完成
window.onload = function () {
  // 检查 D3 和 TopoJSON 是否正确加载
  if (typeof d3 === 'undefined') {
    console.error('D3 library not loaded');
    return;
  }
  if (typeof topojson === 'undefined') {
    console.error('TopoJSON library not loaded');
    return;
  }

  console.log('Libraries loaded, initializing map...');

  var width = 500,
    height = 500;
  var isAutoMode = true;
  var autoTimer = null;
  var countryData = [];

  var centroid = d3.geo.path().projection(function (d) {
    return d;
  }).centroid;

  var projection = d3.geo
    .orthographic()
    .scale(height / 2.0)
    .translate([width / 2, height / 2])
    .clipAngle(90);

  var path = d3.geo.path().projection(projection);

  var graticule = d3.geo.graticule().extent([
    [-180, -90],
    [180 - 0.1, 90 - 0.1]
  ]);

  var svg = d3
    .select('body')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('cursor', 'grab');

  svg
    .append('circle')
    .attr('class', 'world-outline')
    .attr('cx', width / 2)
    .attr('cy', height / 2)
    .attr('r', projection.scale());

  var rotate = d3_geo_greatArcInterpolator();

  // 设置控件事件监听
  setupControls();
  
  // 添加拖拽旋转功能
  setupDragRotation();

  d3.json(
    'https://s3-us-west-2.amazonaws.com/s.cdpn.io/95802/world-110m.json',
    function (error, world) {
      if (error) {
        console.error('Error loading world data:', error);
        return;
      }

      console.log('World data loaded:', world);
      console.log('TopoJSON object:', topojson);

      if (!world || !world.objects || !world.objects.countries) {
        console.error('Invalid world data structure');
        return;
      }

      var countries = topojson.object(
        world,
        world.objects.countries
      ).geometries;
      countryData = countries;

      console.log('Countries loaded:', countries.length, 'countries');

      // 填充国家选择列表
      populateCountrySelect(countries);

      projection.clipAngle(180);

      var backLine = svg
        .append('path')
        .datum(graticule)
        .attr('class', 'back-line')
        .attr('d', path);

      var backCountry = svg
        .selectAll('.back-country')
        .data(countries)
        .enter()
        .insert('path', '.back-line')
        .attr('class', 'back-country')
        .attr('d', path);

      projection.clipAngle(90);

      var line = svg
        .append('path')
        .datum(graticule)
        .attr('class', 'line')
        .attr('d', path);

      var country = svg
        .selectAll('.country')
        .data(countries)
        .enter()
        .insert('path', '.line')
        .attr('class', 'country')
        .attr('d', path);

      var title = svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', (height * 3) / 5);

      // 存储全局引用
      window.mapElements = {
        backLine: backLine,
        backCountry: backCountry,
        line: line,
        country: country,
        title: title,
        rotate: rotate,
        centroid: centroid,
        projection: projection,
        path: path
      };

      // 开始自动模式
      startAutoMode();
    }
  );

  function setupControls() {
    var radios = document.querySelectorAll('input[name="mode"]');
    var manualControls = document.getElementById('manual-controls');
    var countrySelect = document.getElementById('country-select');

    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (this.value === 'auto') {
          isAutoMode = true;
          manualControls.style.display = 'none';
          startAutoMode();
        } else {
          isAutoMode = false;
          manualControls.style.display = 'block';
          stopAutoMode();
        }
      });
    });

    countrySelect.addEventListener('change', function () {
      if (this.value) {
        jumpToCountry(parseInt(this.value));
      }
    });
  }

  function setupDragRotation() {
    var isDragging = false;
    var previousMousePosition = [0, 0];
    var currentRotation = [0, 0];

    svg.on('mousedown', function() {
      isDragging = true;
      previousMousePosition = d3.mouse(this);
      svg.attr('cursor', 'grabbing');
    });

    svg.on('mousemove', function() {
      if (!isDragging || isAutoMode) return;

      var currentPosition = d3.mouse(this);
      var dx = currentPosition[0] - previousMousePosition[0];
      var dy = currentPosition[1] - previousMousePosition[1];
      
      // 水平旋转（经度）
      currentRotation[0] = (currentRotation[0] + dx * 0.5) % 360;
      
      // 垂直旋转（纬度），限制在-90到90度之间
      currentRotation[1] = Math.max(-90, Math.min(90, currentRotation[1] - dy * 0.3));
      
      updateRotation(currentRotation);
      previousMousePosition = currentPosition;
    });

    svg.on('mouseup', function() {
      isDragging = false;
      svg.attr('cursor', 'grab');
    });

    svg.on('mouseleave', function() {
      isDragging = false;
      svg.attr('cursor', 'grab');
    });

    // 触摸支持
    svg.on('touchstart', function() {
      if (!isAutoMode) {
        isDragging = true;
        var touch = d3.event.touches[0];
        previousMousePosition = [touch.pageX, touch.pageY];
        d3.event.preventDefault();
      }
    });

    svg.on('touchmove', function() {
      if (!isDragging || isAutoMode) return;

      var touch = d3.event.touches[0];
      var currentPosition = [touch.pageX, touch.pageY];
      var dx = currentPosition[0] - previousMousePosition[0];
      var dy = currentPosition[1] - previousMousePosition[1];
      
      // 水平旋转（经度）
      currentRotation[0] = (currentRotation[0] + dx * 0.5) % 360;
      
      // 垂直旋转（纬度），限制在-90到90度之间
      currentRotation[1] = Math.max(-90, Math.min(90, currentRotation[1] - dy * 0.3));
      
      updateRotation(currentRotation);
      previousMousePosition = currentPosition;
      d3.event.preventDefault();
    });

    svg.on('touchend', function() {
      isDragging = false;
    });

    function updateRotation(rotation) {
      if (window.mapElements) {
        var elements = window.mapElements;
        
        // 首先设置clipAngle(180)来显示背面的国家
        elements.projection.rotate(rotation).clipAngle(180);
        elements.backCountry.attr('d', elements.path);
        elements.backLine.attr('d', elements.path);
        
        // 然后设置clipAngle(90)来显示正面的国家并创建3D效果
        elements.projection.rotate(rotation).clipAngle(90);
        elements.country.attr('d', elements.path);
        elements.line.attr('d', elements.path);
      }
    }
  }

  function populateCountrySelect(countries) {
    var select = document.getElementById('country-select');

    console.log('Debug: Countries data:', countries);
    console.log(
      'Debug: Sample country IDs:',
      countries.slice(0, 5).map(function (c) {
        return c.id;
      })
    );

    // 清空现有选项
    select.innerHTML = '<option value="">选择国家</option>';

    countries.forEach(function (country, index) {
      var option = document.createElement('option');
      option.value = index;

      console.log(
        'Debug: Country',
        index,
        'ID:',
        country.id,
        'Type:',
        typeof country.id
      );

      // 直接使用国家ID作为显示名称
      var displayName = country.id || 'Country ' + (index + 1);
      option.textContent = displayName;
      select.appendChild(option);
    });

    console.log('Debug: Total options added:', countries.length);
  }

  function startAutoMode() {
    if (!window.mapElements) return;

    var elements = window.mapElements;
    var countries = countryData;
    var i = -1;
    var n = countries.length;

    function step() {
      if (!isAutoMode) return;

      if (++i >= n) i = 0;

      elements.country.transition().style('fill', function (d, j) {
        return j === i ? 'red' : '#737368';
      });

      d3.transition()
        .delay(250)
        .duration(1250)
        .tween('rotate', function () {
          var point = elements.centroid(countries[i]);
          elements.rotate
            .source(elements.projection.rotate())
            .target([-point[0], -point[1]])
            .distance();
          return function (t) {
            elements.projection.rotate(elements.rotate(t)).clipAngle(180);
            elements.backCountry.attr('d', elements.path);
            elements.backLine.attr('d', elements.path);

            elements.projection.rotate(elements.rotate(t)).clipAngle(90);
            elements.country.attr('d', elements.path);
            elements.line.attr('d', elements.path);
          };
        })
        .transition()
        .each('end', step);
    }

    step();
  }

  function stopAutoMode() {
    // 停止所有过渡动画
    d3.selectAll('svg *').transition().duration(0);
  }

  function jumpToCountry(index) {
    if (!window.mapElements || index < 0 || index >= countryData.length) return;

    var elements = window.mapElements;
    var country = countryData[index];

    // 重置所有国家颜色
    elements.country.style('fill', '#737368');

    // 高亮选中的国家
    elements.country
      .filter(function (d, i) {
        return i === index;
      })
      .style('fill', 'red');

    // 计算目标旋转角度
    var point = elements.centroid(country);
    var targetRotation = [-point[0], -point[1]];

    // 平滑过渡到目标位置
    d3.transition()
      .duration(1250)
      .tween('rotate', function () {
        elements.rotate
          .source(elements.projection.rotate())
          .target(targetRotation)
          .distance();
        return function (t) {
          elements.projection.rotate(elements.rotate(t)).clipAngle(180);
          elements.backCountry.attr('d', elements.path);
          elements.backLine.attr('d', elements.path);

          elements.projection.rotate(elements.rotate(t)).clipAngle(90);
          elements.country.attr('d', elements.path);
          elements.line.attr('d', elements.path);
        };
      });
  }

  var d3_radians = Math.PI / 180;

  function d3_geo_greatArcInterpolator() {
    var x0, y0, cy0, sy0, kx0, ky0, x1, y1, cy1, sy1, kx1, ky1, d, k;

    function interpolate(t) {
      var B = Math.sin((t *= d)) * k,
        A = Math.sin(d - t) * k,
        x = A * kx0 + B * kx1,
        y = A * ky0 + B * ky1,
        z = A * sy0 + B * sy1;
      return [
        Math.atan2(y, x) / d3_radians,
        Math.atan2(z, Math.sqrt(x * x + y * y)) / d3_radians
      ];
    }

    interpolate.distance = function () {
      if (d == null)
        k =
          1 /
          Math.sin(
            (d = Math.acos(
              Math.max(
                -1,
                Math.min(1, sy0 * sy1 + cy0 * cy1 * Math.cos(x1 - x0))
              )
            ))
          );
      return d;
    };

    interpolate.source = function (_) {
      var cx0 = Math.cos((x0 = _[0] * d3_radians)),
        sx0 = Math.sin(x0);
      cy0 = Math.cos((y0 = _[1] * d3_radians));
      sy0 = Math.sin(y0);
      kx0 = cy0 * cx0;
      ky0 = cy0 * sx0;
      d = null;
      return interpolate;
    };

    interpolate.target = function (_) {
      var cx1 = Math.cos((x1 = _[0] * d3_radians)),
        sx1 = Math.sin(x1);
      cy1 = Math.cos((y1 = _[1] * d3_radians));
      sy1 = Math.sin(y1);
      kx1 = cy1 * cx1;
      ky1 = cy1 * sx1;
      d = null;
      return interpolate;
    };

    return interpolate;
  }
};
