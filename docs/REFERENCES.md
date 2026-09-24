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


Additional 0.2.0 primary references:

* Autodesk, HATCH group codes and native fill/pattern metadata:
  https://help.autodesk.com/cloudhelp/2017/ENU/AutoCAD-DXF/files/GUID-C6C71CED-CE0F-4184-82A5-07AD6241F15B.htm
* Autodesk, HATCH boundary paths and native edge records:
  https://help.autodesk.com/cloudhelp/2017/ENU/AutoCAD-DXF/files/GUID-DC5215D6-E73F-4DFF-8BE9-01CA9610FAEE.htm
* Autodesk, arbitrary-axis algorithm:
  https://help.autodesk.com/cloudhelp/2017/ENU/AutoCAD-DXF/files/GUID-E19E5B42-0CC7-4EBA-B29F-5E1D595149EE.htm
* Autodesk, TEXT alignment and generation data:
  https://help.autodesk.com/cloudhelp/2017/ENU/AutoCAD-DXF/files/GUID-62E5383D-8A14-47B4-BFC4-35824CAE8363.htm
* Autodesk, MTEXT properties:
  https://help.autodesk.com/cloudhelp/2017/ENU/AutoCAD-DXF/files/GUID-5E5DB93B-F8D3-4433-ADF7-E92E250D2BAB.htm
* Autodesk, group-code value types; wire angle groups are degrees:
  https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-3F0380A5-1C15-464D-BC66-2C5F094BCFB9.htm
* ezdxf, MTEXT wire-field semantics and independent test authoring:
  https://ezdxf.readthedocs.io/en/stable/dxfentities/mtext.html
* ezdxf, hatch edge paths and clockwise edge endpoint semantics:
  https://ezdxf.readthedocs.io/en/stable/dxfentities/hatch.html

The MTEXT page's APP/API angle wording differs from the general wire-DXF group
code convention. The reader defaults to wire degrees, supports an explicit known
producer override, and the writer uses a direction vector. Independent ezdxf
fixtures verify the chosen exchange behavior. Symbol reference scope and the
absence of certification are documented separately in SYMBOLS.md.
