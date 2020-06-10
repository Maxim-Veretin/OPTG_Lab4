// Ссылка на элемент веб страницы в котором будет отображаться графика
var container;
// Переменные "камера", "сцена" и "отрисовщик"
var camera, scene, renderer;
var N = 100;
var cameraDefaultPos = new THREE.Vector3(N/2, N/2, N*1.5);
var cameraDefaultLook = new THREE.Vector3(N/2, 0, N/2);
var angleCamera = 0;
var verticalOffsetCamera = 0;

var geometry = new THREE.Geometry();

var keyboard = new THREEx.KeyboardState();
var clock = new THREE.Clock();

var cursor3D, circle;
var radius = 10;
var brushDirection = 0;
var brushVisible = false;

var mouse = { x: 0, y: 0};
var targetList = [];
var objectList = [];

var gui = new dat.GUI();
gui.width = 200;

var models = new Map();

var selected = null;
var lbm = false;
var crossedObj = null;

var pastPos = new THREE.Vector3(0,0,0);
var intersectionObj = false;

// Функции инициализации и изменения объектов
init();
animate();

// В этой функции можно добавлять объекты и выполнять их первичную настройку
function init()
{
    // Получение ссылки на элемент html страницы
    container = document.getElementById( 'container' );
    scene = new THREE.Scene();
    // Установка параметров камеры
    // 45 - угол обзора
    // window.innerWidth / window.innerHeight - соотношение сторон
    // 1 - 4000 - ближняя и дальняя плоскости отсечения
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000 );
    
    camera.position.copy(cameraDefaultPos);
    camera.lookAt(cameraDefaultLook);

    // Создание отрисовщика
    renderer = new THREE.WebGLRenderer( { antialias: false } );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor(0x7fc7ff, 1);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild( renderer.domElement );
    // Добавление функции обработки события изменения размеров окна
    window.addEventListener( 'resize', onWindowResize, false );

    //создание точечного источника освещения заданного цвета
    var light = new THREE.DirectionalLight(0xffffff);
    //установка позиции источника освещения
    light.position.set(N*2, N, N*2);
    // направление освещения
    light.target = new THREE.Object3D();
    light.target.position.set( N/2, 0, N/2 );
    scene.add(light.target);

    // включение расчёта теней
    light.castShadow = true;
    // параметры области расчёта теней
    light.shadow = new THREE.LightShadow(new THREE.PerspectiveCamera(45, 1, 10, 1000));
    light.shadow.bias = 0.0001;
    // размер карты теней
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    //добавление источника в сцену
    scene.add(light);

    renderer.domElement.addEventListener('mousedown',onDocumentMouseDown,false);
    renderer.domElement.addEventListener('mouseup',onDocumentMouseUp,false);
    renderer.domElement.addEventListener('mousemove',onDocumentMouseMove,false);
    renderer.domElement.addEventListener('wheel',onDocumentMouseScroll,false);
    renderer.domElement.addEventListener("contextmenu", function (event)
                                                        {
                                                            event.preventDefault();
                                                        });

    CreateGround();
    AddCursor3D();
    Gui();

    LoadStaticModel('models/static/Palm/', 'Palma 001.obj', 'Palma 001.mtl', 0.15, 'palm');
    LoadStaticModel('models/static/Fence/', 'grade.obj', 'grade.mtl', 0.5, 'fence');
    LoadStaticModel('models/static/House/', 'Cyprys_House.obj', 'Cyprys_House.mtl', 1, 'house');
}

function animate()
{
    var delta = clock.getDelta();

    KeyPressed();
    RotateCamera();

    if (brushDirection != 0)
    {
        SphereBrush(brushDirection, delta*15);
    }

    requestAnimationFrame( animate );
    render();
}

function onWindowResize()
{
    // Изменение соотношения сторон для виртуальной камеры
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // Изменение соотношения сторон рендера
    renderer.setSize( window.innerWidth, window.innerHeight );
}

function render()
{
    renderer.render( scene, camera );
}

function CreateGround()
{
    // Добавление координат вершин в массив вершин
    for (var x = 0; x < N; x++)
    {
        for (var z = 0; z < N; z++)
        {
            geometry.vertices.push(new THREE.Vector3( x, 0, z));
        }
    }
    for (var i = 0; i < N-1; i++)
    {
        for (var j = 0; j < N-1; j++)
        {
            var i1 = i + j*N;
            var i2 = (i + 1) + j*N;
            var i3 = (i + 1) + (j + 1)*N;
            var i4 = i + (j + 1)*N;
            
            geometry.faces.push(new THREE.Face3(i1, i2, i3));
            geometry.faces.push(new THREE.Face3(i1, i3, i4));
            
            geometry.faceVertexUvs[0].push([
                new THREE.Vector2(i/(N-1), j/(N-1)),
                new THREE.Vector2((i+1)/(N-1), j/(N-1)),
                new THREE.Vector2((i+1)/(N-1), (j+1)/(N-1))]);
                
            geometry.faceVertexUvs[0].push([
                new THREE.Vector2(i/(N-1), j/(N-1)),
                new THREE.Vector2((i+1)/(N-1), (j+1)/(N-1)),
                new THREE.Vector2(i/(N-1), (j+1)/(N-1))
            ]);
        }
    }
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    // Создание загрузчика текстур
    var loader = new THREE.TextureLoader();
    // Загрузка текстуры grasstile.jpg из папки pics
    var tex = loader.load( 'textures/grasstile.jpg' );
    
    // Режим повторения текстуры 
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;  
    // Повторить текстуру 10х10 раз 
    tex.repeat.set( 2, 2 );

    var mat = new THREE.MeshLambertMaterial({
        // color source is the texture
        map: tex,
        wireframe: false,
        side: THREE.DoubleSide
    });
    // Создание объекта и установка его в определённую позицию
    var groundMesh = new THREE.Mesh(geometry, mat);
    groundMesh.position.set(0.0, 0.0, 0.0);
    groundMesh.receiveShadow = true;
    //groundMesh.castShadow = true;

    // Добавление объекта в сцену
    scene.add(groundMesh);
    targetList.push(groundMesh);
}

function KeyPressed()
{
    if (keyboard.pressed("A"))
    {
        angleCamera += 0.02;
    }
    if (keyboard.pressed("D"))
    {
        angleCamera -= 0.02;
    }
    if (keyboard.pressed("W"))
    {
        verticalOffsetCamera += 1;
    }
    if (keyboard.pressed("S"))
    {
        verticalOffsetCamera -= 1;
    }
}

function RotateCamera()
{
    cameraDefaultPos.x = N/2 + 2*(N/1.5)*Math.cos(angleCamera);
    cameraDefaultPos.z = N/2 + 2*(N/1.5)*Math.sin(angleCamera);

    camera.position.set(cameraDefaultPos.x, cameraDefaultPos.y + verticalOffsetCamera, cameraDefaultPos.z);
    camera.lookAt(cameraDefaultLook);
}

function AddCursor3D()
{
    //параметры цилиндра: диаметр вершины, диаметр основания, высота, число сегментов
    var geometry = new THREE.CylinderGeometry( 1, 0, 3, 64 );
    var cyMaterial = new THREE.MeshLambertMaterial( {color: 0xffff00} );
    cursor3D = new THREE.Mesh( geometry, cyMaterial );
    scene.add( cursor3D );

    cursor3D.visible = brushVisible;

    AddCirleBrush();
}

function AddCirleBrush()
{
    var material = new THREE.LineBasicMaterial( { color: 0xffff00 } );
    radius = 1;
    var segments = 32;
    var circleGeometry = new THREE.CircleGeometry( 1, segments );
    //удаление центральной вершины
    circleGeometry.vertices.shift();

    for (var i = 0; i < circleGeometry.vertices.length; i++)
    {
        circleGeometry.vertices[i].z = circleGeometry.vertices[i].y;
        circleGeometry.vertices[i].y = 0;
    }

    circle = new THREE.Line( circleGeometry, material );
    circle.scale.set(radius, radius, radius);

    scene.add( circle );
    
    circle.visible = brushVisible;
}

function onDocumentMouseDown(event)
{
    if (brushVisible == true)
    {
        if (event.which == 1)
            brushDirection = 1;
        else if (event.which == 3)
            brushDirection = -1;
    }
    else
    {
        lbm = true;

        //определение позиции мыши
        mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = -( event.clientY / window.innerHeight ) * 2 + 1;

        //создание луча, исходящего из позиции камеры и проходящего сквозь позицию курсора мыши
        var vector = new THREE.Vector3( mouse.x, mouse.y, 1 );
        vector.unproject(camera);

        var ray = new THREE.Raycaster( camera.position,
                                vector.sub(camera.position).normalize());
        
        // создание массива для хранения объектов, с которыми пересечётся луч
        var intersects = ray.intersectObjects( objectList, true );

        // если луч пересёк какой-либо объект из списка targetList
        if ( intersects.length > 0 )
        {
            if (selected != null)
            {
                pastPos.copy(selected.position);
                selected.userData.cube.material.visible = false;
                selected = intersects[0].object.userData.model;
                selected.userData.cube.material.visible = true;
                selected.userData.cube.material.color = {r: 1, g: 1, b: 0};
            }
            else
            {
                selected = intersects[0].object.userData.model;
                selected.userData.cube.material.visible = true;
                selected.userData.cube.material.color = {r: 1, g: 1, b: 0};
            }
            
        }
        else if (selected != null)
        {
            selected.userData.cube.material.visible = false;
            selected = null;
        }
    }
}

function onDocumentMouseUp(event)
{
    if (brushVisible == true)
        brushDirection = 0;
    else
    {
        lbm = false;

        if (intersectionObj == true)
        {
            selected.position.copy(pastPos);
            selected.userData.box.setFromObject(selected);
            var pos = new THREE.Vector3();
            selected.userData.box.getCenter(pos);
            selected.userData.obb.position.copy(pos);
            selected.userData.cube.position.copy(pos);

            crossedObj.material.visible = false;

            intersectionObj = false;
        }
    }
}

function onDocumentMouseMove(event)
{
    //определение позиции мыши
    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = -( event.clientY / window.innerHeight ) * 2 + 1;

    //создание луча, исходящего из позиции камеры и проходящего сквозь позицию курсора мыши
    var vector = new THREE.Vector3( mouse.x, mouse.y, 1 );
    vector.unproject(camera);

    var ray = new THREE.Raycaster( camera.position,
                            vector.sub(camera.position).normalize());
    
    // создание массива для хранения объектов, с которыми пересечётся луч
    var intersects = ray.intersectObjects( targetList );

    if (brushVisible == true)
    {
        // если луч пересёк какой-либо объект из списка targetList
        if ( intersects.length > 0 )
        {
            //печать списка полей объекта
            //console.log(intersects[0]);
            if (cursor3D != null)
            {
                cursor3D.position.copy( intersects[0].point);
                cursor3D.position.y += 2.5;

                circle.position.copy( intersects[0].point);
                circle.position.y = 0;
                
                for (var i = 0; i < circle.geometry.vertices.length; i++)
                {
                    //получение позиции в локальной системе координат
                    var pos = new THREE.Vector3();
                    pos.copy(circle.geometry.vertices[i]);
                    //нахождение позиции в глобальной системе координат
                    pos.applyMatrix4(circle.matrixWorld);

                    var x = Math.round(pos.x);
                    var z = Math.round(pos.z);

                    if ( x >= 0 && x < N && z >= 0 && z < N)
                    {
                        var y = geometry.vertices[z + x*N].y;

                        circle.geometry.vertices[i].y = y + 0.2;
                    }
                    else
                        circle.geometry.vertices[i].y = 1.1;
                }
                circle.geometry.verticesNeedUpdate = true; //обновление вершин круга кисти
            }
        }
    }
    else
    {   
        if ( intersects.length > 0)
        {
            //pastPos.copy(selected.position);
            //console.log(pastPos);
            if (selected != null && lbm == true)
            {
                selected.position.copy(intersects[0].point);
                
                selected.userData.box.setFromObject(selected);
                var pos = new THREE.Vector3();
                selected.userData.box.getCenter(pos);
                selected.userData.obb.position.copy(pos);
                selected.userData.cube.position.copy(pos);

                for (var i = 0; i < objectList.length; i++)
                {
                    if (selected.userData.cube != objectList[i])
                    {
                        objectList[i].material.visible = false;
                        objectList[i].material.color = {r: 1, g: 1, b: 0};
                        if (Intersect(selected.userData, objectList[i].userData.model.userData) == true)
                        {
                            objectList[i].material.color = {r: 1, g: 0, b: 0};
                            objectList[i].material.visible = true;
                            intersectionObj = true;
                            crossedObj = objectList[i];
                        }
                    }
                }
            }
        }
    }
}

function onDocumentMouseScroll(event)
{
    if (brushVisible == true)
    {
        if (radius > 1 && event.wheelDelta < 0)
            radius--;

        if (radius < 40 && event.wheelDelta > 0)
            radius++;

        circle.scale.set(radius, 1, radius);
    }
}

function SphereBrush(dir, delta)
{
    for (var i = 0; i < geometry.vertices.length; i++)
    {
        var x1 = cursor3D.position.x;
        var z1 = cursor3D.position.z;
        var x2 = geometry.vertices[i].x;
        var z2 = geometry.vertices[i].z;
        var r = radius;

        var h = r*r - ((x2-x1)*(x2-x1) + (z2-z1)*(z2-z1));
    
        if (h > 0)
        {
            geometry.vertices[i].y += Math.sqrt(h)/10 * delta * dir;
        }
    }
    geometry.computeFaceNormals();
    geometry.computeVertexNormals(); //пересчёт нормалей
    geometry.verticesNeedUpdate = true; //обновление вершин
    geometry.normalsNeedUpdate = true; //обновление нормалей

    { // нереальный флекс
        //if (objectList != null)
        {
            //for (var i = 0; i < objectList.length; i++)
            {
                //objectList[i].position.y = CalcHeight(objectList[i].position.x, objectList[i].position.y);
                //objectList[i].userData.model.position.y = CalcHeight(objectList[i].position.x, objectList[i].position.y);
                //objectList[i].userData.model.userData.box.setFromObject(objectList[i]);
                //var pos = new THREE.Vector3();
                //objectList[i].userData.model.userData.box.getCenter(pos);
                //objectList[i].userData.model.userData.obb.position.copy(pos);
                //objectList[i].userData.model.userData.cube.position.copy(pos);
            }
        }
    }
}

function Gui()
{
    //массив переменных, ассоциированных с интерфейсом
    var params =
    {
        sx: 1, sy: 1, sz: 1, rx: 0,
        brush: false,
        AddPalm: function() { AddMesh('palm') },
        AddFence: function() { AddMesh('fence') },
        AddHouse: function() { AddMesh('house') }
    };
    //создание вкладки
    var folder1 = gui.addFolder('Scale');

    //ассоциирование переменных отвечающих за масштабирование
    //в окне интерфейса они будут представлены в виде слайдера
    //минимальное значение - 1, максимальное – 100, шаг – 1
    //listen означает, что изменение переменных будет отслеживаться
    var meshSX = folder1.add( params, 'sx' ).min(0.5).max(2).step(0.1).listen();
    var meshSY = folder1.add( params, 'sy' ).min(0.5).max(2).step(0.1).listen();
    var meshSZ = folder1.add( params, 'sz' ).min(0.5).max(2).step(0.1).listen();
    var rotX = folder1.add( params, 'rx' ).min(-180).max(180).step(1).listen();
    //при запуске программы папка будет открыта
    folder1.open();

    //описание действий совершаемых при изменении ассоциированных значений
    meshSX.onChange(function(value)
    {
        if (selected != null)
        {
            selected.scale.set(value, params.sy, params.sz);

            var size = new THREE.Vector3();
            selected.userData.box.setFromObject(selected);
            selected.userData.box.getSize(size);
            selected.userData.cube.scale.set(size.x, size.y, size.z);
            selected.userData.box.getSize(selected.userData.obb.halfSize).multiplyScalar(0.5);

            var pos = new THREE.Vector3();
            selected.userData.box.getCenter(pos);
            selected.userData.obb.position.copy(pos);
            selected.userData.cube.position.copy(pos);
        }
    });

    meshSY.onChange(function(value)
    {
        if (selected != null)
        {
            selected.scale.set(params.sx, value, params.sz);

            var size = new THREE.Vector3();
            selected.userData.box.setFromObject(selected);
            selected.userData.box.getSize(size);
            selected.userData.cube.scale.set(size.x, size.y, size.z);
            selected.userData.box.getSize(selected.userData.obb.halfSize).multiplyScalar(0.5);

            var pos = new THREE.Vector3();
            selected.userData.box.getCenter(pos);
            selected.userData.obb.position.copy(pos);
            selected.userData.cube.position.copy(pos);
        }
    });

    meshSZ.onChange(function(value)
    {
        if (selected != null)
        {
            selected.scale.set(params.sx, params.sy, value);

            var size = new THREE.Vector3();
            selected.userData.box.setFromObject(selected);
            selected.userData.box.getSize(size);
            selected.userData.cube.scale.set(size.x, size.y, size.z);
            selected.userData.box.getSize(selected.userData.obb.halfSize).multiplyScalar(0.5);

            var pos = new THREE.Vector3();
            selected.userData.box.getCenter(pos);
            selected.userData.obb.position.copy(pos);
            selected.userData.cube.position.copy(pos);
        }
    });

    rotX.onChange(function(value)
    {
        if (selected!=null)
        {
            selected.rotation.y = value/36;
            selected.userData.box.setFromObject(selected);
            
            selected.userData.cube.rotation.y = value/36;

            var pos = new THREE.Vector3();
            selected.userData.box.getCenter(pos);
            selected.userData.obb.position.copy(pos);
            selected.userData.cube.position.copy(pos);
        }
    });

    //добавление чек бокса с именем brush
    var cubeVisible = gui.add( params, 'brush' ).name('brush').listen();
    
    cubeVisible.onChange(function(value)
    {
        // value принимает значения true и false
        brushVisible = value;
        cursor3D.visible = value;
        circle.visible = value;
    });

    //добавление кнопок, при нажатии которых будут вызываться функции addMesh
    //и delMesh соответственно. Функции описываются самостоятельно.
    gui.add( params, 'AddPalm' ).name( "add palm" );
    gui.add( params, 'AddFence' ).name( "add fence" );
    gui.add( params, 'AddHouse' ).name( "add house" );

    //при запуске программы интерфейс будет раскрыт
    gui.open();
}

// load static model
function LoadStaticModel(path, oname, mname, s, name)
{
    // функция, выполняемая в процессе загрузки модели (выводит процент загрузки)
    var onProgress = function ( xhr ) {
        if ( xhr.lengthComputable ) {
                var percentComplete = xhr.loaded / xhr.total * 100;
                console.log( Math.round(percentComplete, 2) + '% downloaded' );
            }
        };
    // функция, выполняющая обработку ошибок, возникших в процессе загрузки
    var onError = function ( xhr ) { };
    // функция, выполняющая обработку ошибок, возникших в процессе загрузки
    var mtlLoader = new THREE.MTLLoader();
    mtlLoader.setPath( path );
    
    // функция загрузки материала
    mtlLoader.load( mname, function( materials )
    {
        materials.preload();
        var objLoader = new THREE.OBJLoader();
        objLoader.setMaterials( materials );
        objLoader.setPath( path );
        
        // функция загрузки модели
        objLoader.load( oname, function ( object )
        {
            object.receiveShadow = true;
            object.castShadow = true;

            object.traverse( function ( child )
            {
                if ( child instanceof THREE.Mesh )
                {
                    child.receiveShadow = true;
                    child.castShadow = true;
                    child.parent = object;
                }
            });

            object.parent = object;

            var x = Math.random() * N;
            var z = Math.random() * N;
            var y = geometry.vertices[ Math.round(x) + Math.round(z) * (N-10)].y;

            object.position.x = x;
            object.position.y = y;
            object.position.z = z;
            
            object.scale.set(s, s, s);

            //scene.add(object);
            models.set(name, object);
            
        }, onProgress, onError );
    });
}

function AddMesh(name)
{
    if (brushVisible == false)
    {
        var model = models.get(name).clone();

        var x = Math.random() * N;
        var z = Math.random() * N;
        var y = CalcHeight(x, z);

        model.position.x = x;
        model.position.y = y;
        model.position.z = z;

        var box = new THREE.Box3();

        box.setFromObject(model);

        model.userData.box = box;

        var geometry = new THREE.BoxGeometry(1, 1, 1);
        var material = new THREE.MeshBasicMaterial({color: 0xffff00, wireframe: true});
        var cube = new THREE.Mesh(geometry, material);
        scene.add(cube);

        //скрытие объекта
        cube.material.visible = false;

        //получение позиции центра объекта
        var pos = new THREE.Vector3();
        box.getCenter(pos);
        //получение размеров объекта
        var size = new THREE.Vector3();
        box.getSize(size);

        // когда будет реализован попворот, этот базис нужно будет обновлять
        //cube.basis.extractRotation(model.matrixWorld);

        //установка позиции и размера объекта в куб
        cube.position.copy(pos);
        cube.scale.set(size.x, size.y, size.z);

        model.userData.cube = cube;
        cube.userData.model = model;

        //структура состоит из матрицы поворота, позиции и половины размера
        var obb = {
            basis: new THREE.Matrix4(),
            halfSize: new THREE.Vector3(),
            position: new THREE.Vector3()
        };

        //получение позиции центра объекта
        box.getCenter(obb.position);
        //получение размеров объекта
        box.getSize(obb.halfSize).multiplyScalar(0.5);
        //получение матрицы поворота объекта
        obb.basis.extractRotation(model.matrixWorld);

        model.userData.obb = obb;

        objectList.push(cube);
        scene.add(model);
    }
}

function CalcHeight(x, z)
{
    return geometry.vertices[Math.round(z) + Math.round(x) * N].y;
}

function sss(name)
{
    var ind = objectList.indexOf(selected);
    if (~ind)
        objectList.splice(ind, 1);
    scene.remove(selected.userData.box);
    //delete selected.userData.obb;
    scene.remove(selected.userData.cube);
    //scene.remove(selected.userData.obb);
    scene.remove(selected);
}

function Intersect(ob1, ob2)
{
    var xAxisA = new THREE.Vector3();
    var yAxisA = new THREE.Vector3();
    var zAxisA = new THREE.Vector3();
    var xAxisB = new THREE.Vector3();
    var yAxisB = new THREE.Vector3();
    var zAxisB = new THREE.Vector3();
    var translation = new THREE.Vector3();
    var vector = new THREE.Vector3();

    var axisA = [];
    var axisB = [];
    var rotationMatrix = [ [], [], [] ];
    var rotationMatrixAbs = [ [], [], [] ];
    var _EPSILON = 1e-3;

    var halfSizeA, halfSizeB;
    var t, i;

    ob1.obb.basis.extractBasis( xAxisA, yAxisA, zAxisA );
    ob2.obb.basis.extractBasis( xAxisB, yAxisB, zAxisB );

    // push basis vectors into arrays, so you can access them via indices
    axisA.push( xAxisA, yAxisA, zAxisA );
    axisB.push( xAxisB, yAxisB, zAxisB );
    // get displacement vector
    vector.subVectors( ob2.obb.position, ob1.obb.position );
    // express the translation vector in the coordinate frame of the current
    // OBB (this)
    for ( i = 0; i < 3; i++ )
    {
        translation.setComponent( i, vector.dot( axisA[ i ] ) );
    }
    // generate a rotation matrix that transforms from world space to the
    // OBB's coordinate space
    for ( i = 0; i < 3; i++ )
    {
        for ( var j = 0; j < 3; j++ )
        {
            rotationMatrix[ i ][ j ] = axisA[ i ].dot( axisB[ j ] );
            rotationMatrixAbs[ i ][ j ] = Math.abs( rotationMatrix[ i ][ j ] ) + _EPSILON;
        }
    }
    // test the three major axes of this OBB
    for ( i = 0; i < 3; i++ )
    {
        vector.set( rotationMatrixAbs[ i ][ 0 ], rotationMatrixAbs[ i ][ 1 ], rotationMatrixAbs[ i ][ 2 ]
        );
        halfSizeA = ob1.obb.halfSize.getComponent( i );
        halfSizeB = ob2.obb.halfSize.dot( vector );
        
        if ( Math.abs( translation.getComponent( i ) ) > halfSizeA + halfSizeB )
        {
            return false;
        }
    }
    // test the three major axes of other OBB
    for ( i = 0; i < 3; i++ )
    {
        vector.set( rotationMatrixAbs[ 0 ][ i ], rotationMatrixAbs[ 1 ][ i ], rotationMatrixAbs[ 2 ][ i ] );
        halfSizeA = ob1.obb.halfSize.dot( vector );
        halfSizeB = ob2.obb.halfSize.getComponent( i );
        vector.set( rotationMatrix[ 0 ][ i ], rotationMatrix[ 1 ][ i ], rotationMatrix[ 2 ][ i ] );
        t = translation.dot( vector );

        if ( Math.abs( t ) > halfSizeA + halfSizeB )
        {
            return false;
        }
    }
    // test the 9 different cross-axes
    // A.x <cross> B.x
    halfSizeA = ob1.obb.halfSize.y * rotationMatrixAbs[ 2 ][ 0 ] + ob1.obb.halfSize.z *
    rotationMatrixAbs[ 1 ][ 0 ];
    halfSizeB = ob2.obb.halfSize.y * rotationMatrixAbs[ 0 ][ 2 ] + ob2.obb.halfSize.z *
    rotationMatrixAbs[ 0 ][ 1 ];
    t = translation.z * rotationMatrix[ 1 ][ 0 ] - translation.y * rotationMatrix[ 2 ][ 0 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.x < cross> B.y
    halfSizeA = ob1.obb.halfSize.y * rotationMatrixAbs[ 2 ][ 1 ] + ob1.obb.halfSize.z *
    rotationMatrixAbs[ 1 ][ 1 ];
    halfSizeB = ob2.obb.halfSize.x * rotationMatrixAbs[ 0 ][ 2 ] + ob2.obb.halfSize.z *
    rotationMatrixAbs[ 0 ][ 0 ];
    t = translation.z * rotationMatrix[ 1 ][ 1 ] - translation.y * rotationMatrix[ 2 ][ 1 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.x <cross> B.z
    halfSizeA = ob1.obb.halfSize.y * rotationMatrixAbs[ 2 ][ 2 ] + ob1.obb.halfSize.z *
    rotationMatrixAbs[ 1 ][ 2 ];
    halfSizeB = ob2.obb.halfSize.x * rotationMatrixAbs[ 0 ][ 1 ] + ob2.obb.halfSize.y *
    rotationMatrixAbs[ 0 ][ 0 ];
    t = translation.z * rotationMatrix[ 1 ][ 2 ] - translation.y * rotationMatrix[ 2 ][ 2 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.y <cross> B.x
    halfSizeA = ob1.obb.halfSize.x * rotationMatrixAbs[ 2 ][ 0 ] + ob1.obb.halfSize.z *
    rotationMatrixAbs[ 0 ][ 0 ];
    halfSizeB = ob2.obb.halfSize.y * rotationMatrixAbs[ 1 ][ 2 ] + ob2.obb.halfSize.z *
    rotationMatrixAbs[ 1 ][ 1 ];
    t = translation.x * rotationMatrix[ 2 ][ 0 ] - translation.z * rotationMatrix[ 0 ][ 0 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.y <cross> B.y
    halfSizeA = ob1.obb.halfSize.x * rotationMatrixAbs[ 2 ][ 1 ] + ob1.obb.halfSize.z *
    rotationMatrixAbs[ 0 ][ 1 ];
    halfSizeB = ob2.obb.halfSize.x * rotationMatrixAbs[ 1 ][ 2 ] + ob2.obb.halfSize.z *
    rotationMatrixAbs[ 1 ][ 0 ];
    t = translation.x * rotationMatrix[ 2 ][ 1 ] - translation.z * rotationMatrix[ 0 ][ 1 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.y <cross> B.z
    halfSizeA = ob1.obb.halfSize.x * rotationMatrixAbs[ 2 ][ 2 ] + ob1.obb.halfSize.z *
    rotationMatrixAbs[ 0 ][ 2 ];
    halfSizeB = ob2.obb.halfSize.x * rotationMatrixAbs[ 1 ][ 1 ] + ob2.obb.halfSize.y *
    rotationMatrixAbs[ 1 ][ 0 ];
    t = translation.x * rotationMatrix[ 2 ][ 2 ] - translation.z * rotationMatrix[ 0 ][ 2 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.z <cross> B.x
    halfSizeA = ob1.obb.halfSize.x * rotationMatrixAbs[ 1 ][ 0 ] + ob1.obb.halfSize.y *
    rotationMatrixAbs[ 0 ][ 0 ];
    halfSizeB = ob2.obb.halfSize.y * rotationMatrixAbs[ 2 ][ 2 ] + ob2.obb.halfSize.z *
    rotationMatrixAbs[ 2 ][ 1 ];
    t = translation.y * rotationMatrix[ 0 ][ 0 ] - translation.x * rotationMatrix[ 1 ][ 0 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.z <cross> B.y
    halfSizeA = ob1.obb.halfSize.x * rotationMatrixAbs[ 1 ][ 1 ] + ob1.obb.halfSize.y *
    rotationMatrixAbs[ 0 ][ 1 ];
    halfSizeB = ob2.obb.halfSize.x * rotationMatrixAbs[ 2 ][ 2 ] + ob2.obb.halfSize.z *
    rotationMatrixAbs[ 2 ][ 0 ];
    t = translation.y * rotationMatrix[ 0 ][ 1 ] - translation.x * rotationMatrix[ 1 ][ 1 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // A.z <cross> B.z
    halfSizeA = ob1.obb.halfSize.x * rotationMatrixAbs[ 1 ][ 2 ] + ob1.obb.halfSize.y *
    rotationMatrixAbs[ 0 ][ 2 ];
    halfSizeB = ob2.obb.halfSize.x * rotationMatrixAbs[ 2 ][ 1 ] + ob2.obb.halfSize.y *
    rotationMatrixAbs[ 2 ][ 0 ];
    t = translation.y * rotationMatrix[ 0 ][ 2 ] - translation.x * rotationMatrix[ 1 ][ 2 ];
    
    if ( Math.abs( t ) > halfSizeA + halfSizeB )
    {
        return false;
    }
    // no separating axis exists, so the two OBB don't intersect
    return true;
}