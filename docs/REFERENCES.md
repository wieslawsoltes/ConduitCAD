# Primary implementation references

These references informed interoperability and browser API choices. They are
not a claim of complete compliance or a substitute for executable validation.

* Autodesk, **LWPOLYLINE (DXF)**: group codes, vertices, closure and bulges.
  https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm
* Autodesk, **INSERT (DXF)**: block references, insertion transforms, arrays and attributes.
  https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-28FA4CFB-9D5E-4880-9F11-36C97578252F.htm
* W3C, **Pointer Events Level 3**: pointer capture and input event semantics.
  https://www.w3.org/TR/pointerevents3/
* W3C, **WebGPU**: storage buffers, queue writes, compute/render passes and indirect draw semantics.
  https://www.w3.org/TR/webgpu/
* GPU for the Web, **GPUQueue API reference**: typed-array element offsets versus ArrayBuffer byte offsets.
  https://gpuweb.github.io/types/interfaces/GPUQueue.html
* MDN, **GPUDevice.lost**: device loss and recreation requirements.
  https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost
* ezdxf project, **Colors module**: independent ACI palette reference and conversion semantics.
  https://ezdxf.readthedocs.io/en/stable/colors.html
* ezdxf project, **Common graphical attributes**: ACI, true color and layer/instance inheritance.
  https://ezdxf.readthedocs.io/en/stable/tutorials/common_graphical_attributes.html

The delivered ACI numeric palette has an MIT notice in `THIRD_PARTY_NOTICES.md`.
Other runtime code, UI icons and example geometry were implemented for Conduit.
